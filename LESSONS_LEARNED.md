# Lessons Learned - Medusa Multistore on Railway

## Railway Deployment

### Database Connections
- Railway internal URLs (e.g., `postgres-vx0t.railway.internal:5432`) only work inside Railway's private network
- External proxy URLs (e.g., `mainline.proxy.rlwy.net:27327`) are for connecting from outside Railway
- Both point to the same database - don't create tables on the wrong connection endpoint

### Service Linking
- Services must be explicitly linked in Railway dashboard for internal networking to work
- You can see linked services by the "arrows" connecting them in the Railway project view
- If DATABASE_URL uses `.railway.internal`, the services MUST be linked

### Environment Variables
- `backendUrl` in Medusa admin config is baked in at BUILD TIME, not runtime
- Cannot use env vars for `backendUrl` in Docker builds - must hardcode the production URL
- CORS settings need to include all domains that will access the API

## Medusa v2 Specifics

### Admin Build Location
- Medusa builds admin to `.medusa/server/public/admin/`
- But at runtime, Medusa looks for admin at `./public/admin/`
- **FIX**: Add to Dockerfile: `cp -r /app/.medusa/server/public/admin /app/public/admin`

### Admin UI Extensions
- Widgets go in `src/admin/widgets/`
- Custom routes go in `src/admin/routes/{route-name}/page.tsx`
- Use `defineWidgetConfig` and `defineRouteConfig` from `@medusajs/admin-sdk`

### Medusa UI Components
- `Select.Item` CANNOT have an empty string `value=""`
- Use a placeholder value like `value="__default__"` instead
- This is because empty string is reserved for "clear selection"

## Multi-Tenant Architecture

### PostgreSQL Schema Isolation
- Create a `tenants` table in the `public` schema to register tenants
- Each tenant gets their own schema (e.g., `tenant_acme`)
- Use `search_path` to route queries to tenant schemas

### Tenant Resolution
- Resolve tenant from: X-Tenant-ID header > custom domain > subdomain
- Use AsyncLocalStorage for request-scoped tenant context
- Cache tenant lookups to avoid DB hits on every request

### Middleware Setup
- Apply tenant middleware to `/store/*` and `/admin/*` routes
- Bypass tenant resolution for management routes like `/admin/tenants`

### CRITICAL: SET search_path Behavior
- `SET LOCAL search_path` ONLY works inside a transaction - it's discarded immediately otherwise
- `SET search_path` (without LOCAL) sets it for the entire session/connection
- In a connection-pooled environment, you MUST reset the search_path after each request
- Otherwise, a connection returned to the pool keeps the tenant's search_path and leaks to the next request!

### Working Pattern for Tenant DB Isolation
```typescript
// In middleware - SET at request start
await pgConnection.raw(`SET search_path TO "${tenant.schemaName}", public`)

// Reset on response finish to prevent leaking to next request
res.on('finish', async () => {
  await pgConnection.raw('SET search_path TO public')
})
```

### Why MikroORM Patching Didn't Work
- MikroORM transactions use separate connections from the pool
- Patching `beginTransaction` sets search_path in transaction, but other queries run outside transactions
- Prepending `SET LOCAL` to queries doesn't work without a transaction context
- The solution is to use session-level `SET search_path` (not LOCAL) in middleware

### Tenant Schema Seeding - Essential Reference Data
When creating a new tenant schema, you MUST seed these essential tables:

1. **Currencies** - Copy ALL columns from public.currency (including `decimal_digits`, `rounding`, `raw_rounding`)
2. **Sales Channel** - Create a "Default Sales Channel" and link to store.default_sales_channel_id
3. **Payment Providers** - Copy from public.payment_provider (at minimum `pp_system_default`)
4. **Fulfillment Providers** - Copy from public.fulfillment_provider (at minimum `manual_manual`)
5. **Region** - Create at least one region (e.g., "United States" with currency_code='usd') and link to store.default_region_id

6. **Store Currencies** - Link currencies to the store via `store_currency` table (at minimum USD, EUR, GBP, CAD, AUD)

**Why this matters**: Without this data, the Medusa admin UI will show errors or empty states. Products can't be created without a sales channel. Orders can't be processed without regions, payment providers, and fulfillment providers. Currencies won't appear in the "Create Region" dropdown without `store_currency` entries.

**Common pitfall**: When copying currencies, you must include ALL columns. The tenant schema has the same structure but some columns have NOT NULL constraints:
```sql
-- WRONG (missing columns causes NOT NULL violation)
INSERT INTO tenant_schema.currency (code, symbol, symbol_native, name, ...)

-- CORRECT (include all columns)
INSERT INTO tenant_schema.currency
  (code, symbol, symbol_native, decimal_digits, rounding, raw_rounding, name, created_at, updated_at, deleted_at)
SELECT * FROM public.currency
```

### Store Currency Linking - CRITICAL
Having currencies in the `currency` table is NOT enough! Medusa also requires currencies to be linked to the store via the `store_currency` table. Without this, currencies won't appear in the region creation UI.

```sql
-- Currency exists in currency table but won't appear in UI
SELECT * FROM tenant_schema.currency WHERE code = 'usd';  -- ✓ exists

-- Need this linking entry for currency to appear
INSERT INTO tenant_schema.store_currency
  (id, currency_code, is_default, store_id, created_at, updated_at)
VALUES
  ('stocur_xxx', 'usd', true, 'store_xxx', NOW(), NOW());
```

**Recommended store currencies for new tenants**: USD (default), EUR, GBP, CAD, AUD

### Auth Tables Must ONLY Exist in Public Schema - CRITICAL
When creating tenant schemas, do NOT copy these tables:
- `user`
- `auth_identity`
- `provider_identity`
- `invite`
- `user_tenant_assignments`

**Why this matters**: PostgreSQL's `search_path` searches tenant schema first. If empty auth tables exist in tenant schemas, Medusa's auth middleware finds them (empty) instead of the public schema tables, causing random logouts and "not authenticated" errors.

**Symptoms of this bug**:
- Random logouts while browsing
- 401 errors on admin routes
- "Invalid email or password" after being logged in
- Authentication working sometimes but not others

**Fix**: Drop these tables from existing tenant schemas:
```sql
DROP TABLE IF EXISTS tenant_xxx.auth_identity CASCADE;
DROP TABLE IF EXISTS tenant_xxx.provider_identity CASCADE;
DROP TABLE IF EXISTS tenant_xxx.user CASCADE;
DROP TABLE IF EXISTS tenant_xxx.invite CASCADE;
```

### MikroORM Uses Separate pg Module - CRITICAL

Medusa 2.0 uses MikroORM which bundles its own `pg` module at `node_modules/@mikro-orm/postgresql/node_modules/pg/`. Setting `search_path` via middleware on the Knex connection (`PG_CONNECTION`) does NOT affect MikroORM queries.

**Symptoms of this bug**:
- Middleware logs show `SET search_path TO tenant_xxx` but queries return data from public schema
- API keys, products, or other entities from all tenants appear in tenant-specific views
- Data created in one tenant appears in another tenant's admin

**Root cause**: MikroORM's PostgreSQL driver uses a separate connection pool from Knex. When middleware sets `search_path` on the Knex connection, MikroORM queries still use the default `public` schema.

**Fix**: Patch the pg Client at startup to run `SET search_path` as a **separate query** before each data query:

```typescript
// src/instrumentation.ts - imported in medusa-config.ts
import { getCurrentTenant } from './lib/tenant-context'
import path from 'path'

export function patchPgForTenantIsolation(): void {
  // Patch main pg module
  const pg = require('pg')
  patchPgClient(pg.Client)

  // Patch MikroORM's nested pg module
  const mikroOrmPgPath = require.resolve('pg', {
    paths: [path.dirname(require.resolve('@mikro-orm/postgresql'))]
  })
  const mikroOrmPg = require(mikroOrmPgPath)
  patchPgClient(mikroOrmPg.Client)
}

function patchPgClient(Client: any) {
  const originalQuery = Client.prototype.query
  Client.prototype.query = function(config: any, values?: any, callback?: any) {
    const tenant = getCurrentTenant()
    const queryText = typeof config === 'string' ? config : (config?.text || '')

    if (tenant?.schemaName && tenant.schemaName !== 'public') {
      // Skip if query already contains search_path
      if (queryText.toLowerCase().includes('search_path')) {
        return originalQuery.call(this, config, values, callback)
      }

      // Run SET search_path as separate query first, then the actual query
      const setSearchPath = `SET search_path TO "${tenant.schemaName}", public`
      return originalQuery.call(this, setSearchPath)
        .then(() => originalQuery.call(this, config, values))
    }
    return originalQuery.call(this, config, values, callback)
  }
}
```

**Critical gotchas**:
1. PostgreSQL doesn't allow multiple statements in prepared statements - you CANNOT prepend `SET search_path;` to the query string
2. You must run `SET search_path` as a **separate query** before the actual query
3. Don't cache the search_path per connection - pooled connections get reused across requests with different tenant contexts
4. Skip queries that already contain `search_path` to avoid infinite loops

**Key insight**: Import instrumentation in `medusa-config.ts` (runs at startup before connections are created):
```typescript
// medusa-config.ts
import './src/instrumentation'
```

### Medusa Admin Routes Authentication
- All `/admin/*` routes automatically require authentication via Medusa's built-in auth
- To create unauthenticated admin-level routes, put them outside `/admin/` (e.g., `/tenants`)
- Using `authenticate(..., { allowUnregistered: true })` does NOT bypass the auth requirement

### Middleware Path Detection
- In Medusa middleware, `req.path` may be relative to the route matcher pattern
- For `/admin/*` matcher, `req.path` might show `/` instead of `/admin/users/me`
- **FIX**: Always use `req.originalUrl || req.url || req.path` for full path detection
- This is critical for bypass logic that checks if a path should skip tenant isolation

### Admin UI Tenant Switching
- The Medusa admin UI caches data after initial page load
- When switching tenants (via cookie), cached React components don't refetch data
- React Query caches entity IDs in sessionStorage - these become invalid after tenant switch
- **FIX**: Must clear ALL storage when switching tenants:
  ```typescript
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem("currentTenantSlug", newSlug) // restore only this
  window.location.href = '/app?t=' + Date.now() // cache-bust redirect
  ```
- Redirect to `/app` (dashboard) instead of reload - avoids 404s on entity-specific pages
- Entity IDs like `sc_01KDE...` are unique per schema - can't reference across tenants

### Bulletproof Tenant Switching (Race Condition Fix)
- Fast clicking on tenant switch can cause race conditions where old tenant data loads
- Cookie may not be fully written before browser starts fetching new page
- **FIX**: Create a shared utility (`src/admin/lib/tenant-switch.ts`) with:
  ```typescript
  // 1. Global lock to prevent double-clicks
  let isSwitching = false

  // 2. Show loading overlay immediately
  showLoadingOverlay()

  // 3. Set cookie with SameSite attribute
  document.cookie = `x-tenant-id=${slug}; path=/; SameSite=Lax`

  // 4. Small delay to ensure cookie is written
  setTimeout(() => {
    window.location.href = '/app?_tenant=' + Date.now()
  }, 50)
  ```
- Disable Select/Button components during switch to prevent spam clicks
- The 50ms delay is key - gives browser time to process cookie before navigation

### Shared Resources Pattern
- Some resources must always use `public` schema regardless of tenant context:
  - `/admin/users` - Users are shared across all tenants
  - `/admin/invites` - Invites are shared
  - `/admin/auth` and `/auth` - Authentication is shared
- Both tenant resolution AND search_path middleware must bypass these paths
- Without bypass, user queries fail with 404 because users table doesn't exist in tenant schemas

### Super Admin Protection
- Tenant management routes need protection so only platform owners can access
- Use user metadata field `is_super_admin: true` to identify super admins
- **CRITICAL**: Custom middleware runs BEFORE Medusa's auth middleware resolves `loggedInUser`
- **Solution**: Check super admin directly in route handlers, NOT middleware

**Working Implementation** (in route handler):
```typescript
// src/api/admin/tenants/route.ts
function checkSuperAdmin(req: MedusaRequest, res: MedusaResponse): boolean {
  const loggedInUser = req.scope.resolve("loggedInUser", {
    allowUnregistered: true,
  }) as { id: string; metadata?: Record<string, unknown> } | undefined

  if (!loggedInUser) {
    res.status(401).json({ message: 'Authentication required' })
    return false
  }

  if (!loggedInUser.metadata?.is_super_admin) {
    res.status(403).json({ message: 'Super Admin access required' })
    return false
  }

  return true
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkSuperAdmin(req, res)) return
  // ... rest of handler
}
```

**Set user metadata in database**:
```sql
UPDATE public."user"
SET metadata = '{"is_super_admin": true}'::jsonb
WHERE email = 'admin@example.com';
```

- Based on Igor Khomenko's Super Admin pattern from multivendor marketplace series

### Middleware Execution Order in Medusa
- Custom middlewares defined in `middlewares.ts` run BEFORE Medusa's internal auth
- At middleware time, `req.scope.resolve("loggedInUser")` returns undefined
- By the time route handlers run, Medusa has resolved the authenticated user
- **Lesson**: For auth-dependent checks, use route handlers not middleware

### Getting Authenticated User in Custom Routes (Medusa 2.0)
- **DO NOT USE**: `req.scope.resolve("loggedInUser")` - this doesn't work in custom routes
- **USE**: `req.auth_context.actor_id` from `AuthenticatedMedusaRequest`
- The `actor_id` contains the user ID for authenticated admin requests
- You must import `AuthenticatedMedusaRequest` instead of `MedusaRequest`

**Working Example**:
```typescript
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const userId = req.auth_context?.actor_id

  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  // Now query user from database to check metadata
  const user = await db.query('SELECT * FROM public."user" WHERE id = $1', [userId])
  // ...
}
```

- Reference: [Medusa Protected Routes Documentation](https://docs.medusajs.com/learn/fundamentals/api-routes/protected-routes)

### Custom Route Authentication Gotcha
- Custom routes outside `/admin/*` (e.g., `/tenants`) don't get Medusa's session authentication
- Using `authenticate('user', ['session', 'bearer'])` on custom routes returns 401 even with valid session
- **Solution**: Move protected routes under `/admin/*` where auth is automatic
- Example: Use `/admin/tenants` instead of `/tenants` for tenant management API
- Frontend calls should use `/admin/tenants` with `credentials: "include"`

## Docker Best Practices

### Build Optimization
- `NODE_OPTIONS="--max-old-space-size=4096"` for large builds
- Install build deps (python3, make, g++) for native modules
- Use `--legacy-peer-deps` for npm install if needed

### Start Script Pattern
```dockerfile
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'npx medusa db:migrate' >> /app/start.sh && \
    echo 'npm run start' >> /app/start.sh && \
    chmod +x /app/start.sh

CMD ["/app/start.sh"]
```

## Common Gotchas

1. **Table doesn't exist errors**: Check if you're connected to the right database
2. **Admin shows localhost URLs**: `backendUrl` wasn't set correctly at build time
3. **CORS errors**: Add your domain to STORE_CORS, ADMIN_CORS, AUTH_CORS
4. **Empty Select.Item crash**: Use non-empty placeholder value
5. **Service can't connect**: Check Railway service linking in dashboard
6. **404 on /admin/users/me after tenant switch**: Bypass paths not working - use `req.originalUrl` not `req.path`
7. **Stale data after tenant switch**: Admin UI caches data - must clear localStorage AND sessionStorage
8. **"Sales channel with id X not found" after tenant switch**: Entity IDs are schema-specific - clear all storage and redirect to dashboard
9. **Filtered localStorage clearing not enough**: Medusa/React Query may store IDs in unexpected keys - use `localStorage.clear()` + `sessionStorage.clear()` instead of filtering
10. **Stale store name after fast tenant switch**: Race condition - cookie not written before navigation starts - add 50ms delay before redirect
11. **403 Forbidden on /tenants after adding super admin protection**: User doesn't have `is_super_admin: true` in metadata - update user in database
12. **401 Unauthorized on custom routes outside /admin/***: Medusa's `authenticate()` middleware doesn't work reliably for routes outside `/admin/*` - move routes under `/admin/*` instead (e.g., `/admin/tenants` instead of `/tenants`)
13. **Super admin middleware always returns 401 "No logged in user"**: Custom middleware runs BEFORE Medusa resolves the authenticated user - move super admin check into route handler instead of middleware
14. **Custom route handler can't find loggedInUser**: `req.scope.resolve("loggedInUser")` doesn't work in custom routes - use `req.auth_context.actor_id` from `AuthenticatedMedusaRequest` instead
15. **404 on /admin/users/me with tenant selected**: `/admin/me` queries `public.user` table which doesn't exist in tenant schemas - add `/admin/me` to bypass paths in ALL tenant middlewares (tenant.ts, tenant-db.ts, tenant-admin-context.ts)

## Multi-Tenant Admin Support (Phase 7)

### Klaviyo-Style Per-Tenant Roles
Instead of storing a single `tenant_slug` in user metadata, use a separate `user_tenant_assignments` table:
- Users can be assigned to multiple tenants with different roles (admin, editor, viewer)
- `last_accessed_at` tracks which tenant user accessed most recently
- Super admins still have access to all tenants without needing assignments

### Updated `/admin/me/role` Response
```json
{
  "role": {
    "id": "user_xxx",
    "email": "user@example.com",
    "is_super_admin": false,
    "tenants": [
      { "tenant_slug": "store-a", "tenant_name": "Store A", "role": "admin" },
      { "tenant_slug": "store-b", "tenant_name": "Store B", "role": "editor" }
    ],
    "tenant_slug": "store-a",  // Legacy: first tenant
    "tenant_name": "Store A"   // Legacy: first tenant name
  }
}
```

### Store Switcher Widget Views
1. **Single-tenant admins**: Read-only view showing their one store
2. **Multi-tenant admins**: Dropdown to switch between their assigned stores (with role badges)
3. **Super admins**: Full access to all stores + ability to create new ones

### Bypass Paths for Shared Resources
Must be added to ALL three middlewares for consistency:
- `tenant.ts` - tenant resolution
- `tenant-db.ts` - search_path setting
- `tenant-admin-context.ts` - tenant access enforcement

Complete bypass list:
```typescript
const BYPASS_PATHS = [
  '/admin/tenants',   // Tenant management
  '/admin/users',     // Users are shared
  '/admin/me',        // Current user - uses public.user
  '/admin/invites',   // Invites are shared
  '/admin/auth',      // Auth is shared
  '/auth',            // Auth routes
]
```

## Creating Admin Users Programmatically (Medusa 2.0)

### The 3-Table Auth System
Medusa 2.0 uses three interconnected tables for authentication:

1. **`public.user`** - Basic user info
   - `id`: User ID (e.g., `user_01KDJ...`)
   - `email`: User email
   - `metadata`: JSONB for custom data like `{ tenant_slug: "attack-dog" }` or `{ is_super_admin: true }`

2. **`public.auth_identity`** - Auth session info
   - `id`: Auth identity ID (e.g., `authid_01KDJ...`)
   - `app_metadata`: Must contain `{ "user_id": "<user_id>" }` to link to user

3. **`public.provider_identity`** - Actual credentials
   - `id`: Provider identity ID
   - `entity_id`: The email address (lookup key)
   - `provider`: The auth provider (e.g., `"emailpass"`)
   - `auth_identity_id`: Links to `auth_identity.id`
   - `provider_metadata`: Contains `{ "password": "<base64_hash>" }`

### Password Hashing - CRITICAL
Medusa uses the `scrypt-kdf` library, NOT raw scrypt. **The format is completely different!**

**WRONG** (raw scrypt - what I tried first):
```
[scrypt prefix][params][salt 16 bytes][derived key 64 bytes]
```

**CORRECT** (scrypt-kdf format):
```
[scrypt prefix 6b][version 1b][logN 1b][r 4b][p 4b][salt 32b][checksum 16b][hmac-hash 32b]
```

The scrypt-kdf library stores:
- 32-byte salt (not 16)
- SHA256 checksum of params+salt
- HMAC-SHA256 hash (using derived key) instead of raw derived key

**Working password generation**:
```javascript
const Scrypt = require('scrypt-kdf');

const password = 'YourPassword123!';
const hash = await Scrypt.kdf(password, { logN: 15, r: 8, p: 1 });
const base64Hash = hash.toString('base64');

// Verify it works
const isValid = await Scrypt.verify(hash, password);
```

### Complete User Creation Script
```javascript
const { Client } = require('pg');
const Scrypt = require('scrypt-kdf');
const crypto = require('crypto');

async function createTenantAdmin(email, password, tenantSlug) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // 1. Create user
  const userId = 'user_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  await client.query(
    `INSERT INTO public."user" (id, email, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())`,
    [userId, email, JSON.stringify({ tenant_slug: tenantSlug })]
  );

  // 2. Create auth_identity
  const authId = 'authid_' + crypto.randomUUID().replace(/-/g, '').slice(0, 26).toUpperCase();
  await client.query(
    `INSERT INTO public.auth_identity (id, app_metadata, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())`,
    [authId, JSON.stringify({ user_id: userId })]
  );

  // 3. Generate password hash using scrypt-kdf
  const hash = await Scrypt.kdf(password, { logN: 15, r: 8, p: 1 });

  // 4. Create provider_identity
  const providerId = crypto.randomUUID().replace(/-/g, '').slice(0, 26).toUpperCase();
  await client.query(
    `INSERT INTO public.provider_identity
     (id, entity_id, provider, auth_identity_id, provider_metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    [
      providerId,
      email,
      'emailpass',
      authId,
      JSON.stringify({ password: hash.toString('base64') })
    ]
  );

  await client.end();
  console.log('Created user:', userId);
}
```

### Common Pitfalls
1. **Memory limit error with raw scrypt**: Using raw `crypto.scryptSync` with N=32768 can hit memory limits. The scrypt-kdf library handles this properly.

2. **Wrong hash format**: If you manually construct the hash buffer, Medusa will always return "Invalid email or password" because the verification uses HMAC, not raw key comparison.

3. **Missing table links**: All three tables must be properly linked:
   - `auth_identity.app_metadata.user_id` → `user.id`
   - `provider_identity.auth_identity_id` → `auth_identity.id`

4. **Entity ID is the email**: The `provider_identity.entity_id` field stores the email, which is used as the lookup key during login.

5. **Deploy after creating user**: The role/tenant enforcement middleware needs to be deployed for the tenant admin to see their assigned store.

## S3 File Storage with Tenant Isolation

### Architecture Decision
Shopify does NOT use custom domains for product images - they use a central CDN (`cdn.shopify.com/{store_id}/...`). However, for SEO benefits, we store **relative URLs** (`/cdn/products/...`) that the frontend can proxy through the tenant's domain.

### S3 Bucket Structure
```
s3://medusa-multistore-assets/
├── attack-dog/products/...   # Tenant-specific
├── ivan-pleeh/products/...   # Tenant-specific
└── public/files/...          # Fallback for non-tenant context
```

### Why Relative URLs?
- **SEO**: Images appear on tenant's domain (`attackdog.com/cdn/products/...`)
- **Flexibility**: Frontend controls CDN/proxy layer via Vercel rewrites
- **Backlinks**: Image references point to tenant's domain, not shared CDN

### Vercel Frontend Configuration
Each tenant's Next.js frontend needs this rewrite:
```javascript
// next.config.js
async rewrites() {
  return [{
    source: '/cdn/:path*',
    destination: `https://medusa-multistore-assets.s3.us-east-1.amazonaws.com/${process.env.TENANT_SLUG}/:path*`,
  }]
}
```

### Custom File Service vs Medusa's Built-in
We created a custom `TenantFileService` instead of using Medusa's built-in file module because:
1. Medusa's S3 module doesn't support dynamic prefixes per request
2. We need to inject tenant slug from AsyncLocalStorage context
3. Presigned URLs need tenant prefix baked in

### Key Implementation Details

**Tenant prefix injection:**
```typescript
private getTenantPrefix(): string {
  const tenant = getCurrentTenant()
  return tenant ? tenant.slug : 'public'  // Fallback for super admin context
}
```

**File upload middleware:**
```typescript
import fileUpload from 'express-fileupload'
const fileUploadMiddleware = fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  abortOnLimit: true,
  useTempFiles: false,
})
```

### S3 Bucket Permissions
The IAM user needs scoped permissions:
```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
  "Resource": [
    "arn:aws:s3:::medusa-multistore-assets",
    "arn:aws:s3:::medusa-multistore-assets/*"
  ]
}
```

### Common Gotchas
1. **Bucket public access**: Must disable "Block all public access" for images to be publicly viewable
2. **CORS configuration**: Required for browser-direct uploads via presigned URLs
3. **Cache-Control header**: Set `public, max-age=31536000` for aggressive CDN caching
4. **express-fileupload**: Must be added to middleware chain for `/admin/files/*` routes

## Custom Admin Domain Setup

### The Shopify Model
Shopify uses a unified admin domain (`admin.shopify.com`) for all merchants, not per-tenant admin domains. This simplifies:
- SSL certificate management
- Cookie/session handling
- CORS configuration

We follow this pattern with `admin.radicalz.io`.

### Critical: Admin Build Path Mismatch

**Problem**: `medusa build` outputs admin to `.medusa/server/public/admin/`, but `medusa start` looks for it at `./public/admin/` (relative to rootDirectory).

**Error you'll see**:
```
Error: Could not find index.html in the admin build directory.
Make sure to run 'medusa build' before starting the server.
```

**Solution**: In Dockerfile, copy admin after build:
```dockerfile
RUN mkdir -p /app/public && \
    cp -r /app/.medusa/server/public/admin /app/public/admin
```

**Why this happens**: The `serve` function in `@medusajs/admin-bundler` uses:
```javascript
outDir: path.join(rootDirectory, "./public/admin")
```
But `medusa build` outputs to `.medusa/server/public/admin/`.

### Railway Custom Domain Setup

1. Add domain via Railway CLI:
   ```bash
   railway domain admin.radicalz.io --service medusa-backend
   ```

2. Add CNAME record in DNS provider:
   - Type: CNAME
   - Name: `admin`
   - Value: `{hash}.up.railway.app` (Railway provides this)

3. Update CORS environment variables to include new domain:
   ```
   ADMIN_CORS=...,https://admin.radicalz.io
   AUTH_CORS=...,https://admin.radicalz.io
   ```

4. Update `medusa-config.ts`:
   ```typescript
   admin: {
     backendUrl: "https://admin.radicalz.io",
   }
   ```

### Debugging Admin Not Found

If admin returns 404 or "index.html not found":

1. **Check build output exists**:
   ```bash
   ls -la /app/.medusa/server/public/admin/
   ```

2. **Check if copied correctly**:
   ```bash
   ls -la /app/public/admin/
   ```

3. **Verify Medusa's expected path**: The `ADMIN_RELATIVE_OUTPUT_DIR` constant is `"./public/admin"` in `@medusajs/medusa/dist/utils/admin-consts.js`

4. **Docker layer caching**: If debugging scripts don't appear in logs, Railway may be using cached layers. Change something early in Dockerfile to bust cache.

## User & Role Management System

### Role Hierarchy
Implemented a 4-tier role system for tenant access control:

| Role | Level | Capabilities |
|------|-------|--------------|
| `owner` | 4 | Full access, can manage team including other owners |
| `admin` | 3 | Most access, can manage team except owners |
| `editor` | 2 | Can edit products and orders only |
| `viewer` | 1 | Read-only access |

### Key Design Decisions

**1. Super Admins Can Only Create Stores**
Random users cannot create tenants. Only users with `metadata.is_super_admin === true` can:
- Access `/admin/tenants` POST endpoint
- See the "Stores" page in admin
- Create new users via `/admin/users`

**2. Tenant Team Management is Scoped**
The `/admin/team` endpoints operate on the **current tenant context** (from cookie), not a specified tenant. This allows tenant owners/admins to manage their own team without super admin access.

**3. RBAC Utilities on Both Server and Client**
- Server: `src/api/middlewares/rbac.ts` - Used in API route handlers
- Client: `src/admin/lib/rbac.ts` - Used in React components for UI visibility

**4. Permission Enforcement Pattern**
```typescript
// In team API routes
const { role: actorRole, isSuperAdmin } = await getActorTenantRole(actorId, tenantSlug, client)

// Super admins always have full access
if (isSuperAdmin) return true

// Otherwise check role-based permissions
if (!canManageTeam(actorRole)) {
  return res.status(403).json({ message: 'Only owners and admins can manage team' })
}
```

### Common Gotchas

1. **Can't change your own role**: Self-demotion/removal is blocked in API handlers
2. **Owners can only be removed by other owners**: Admins cannot remove owners
3. **Super admins act as "owner" in any tenant**: They have full access everywhere
4. **Team Panel only visible to owners/admins**: Widget checks `canManageTeam()` before rendering

### React Hooks for RBAC
```typescript
// Get current user's role in selected tenant
const currentRole = useCurrentTenantRole()  // 'owner' | 'admin' | 'editor' | 'viewer' | null

// Permission checks
const canManage = useCanManageTeam()    // owner or admin
const canChangeRoles = useCanChangeRoles()  // owner only (or super admin)
```

### API Endpoint Security Summary

| Endpoint | Who Can Access |
|----------|----------------|
| `GET /admin/users` | Super Admin only |
| `POST /admin/users` | Super Admin only |
| `GET /admin/team` | Tenant Owner/Admin |
| `POST /admin/team` | Tenant Owner/Admin |
| `PATCH /admin/team/:id` | Tenant Owner only |
| `DELETE /admin/team/:id` | Owner/Admin (respecting hierarchy) |

---

## Subscribe & Save System (Dec 30, 2025)

### Overview
Implemented a per-product subscription system allowing customers to subscribe to products for recurring delivery with frequency-based discounts.

### Key Architecture Decisions

**1. ProductSubscription vs Subscription Model**
The existing `Subscription` model is for plan-based subscriptions (bundled products with a subscription plan). `ProductSubscription` is different - it tracks individual product recurring purchases:

| Model | Purpose | Linked To |
|-------|---------|-----------|
| `Subscription` | Plan-based (multi-product bundles) | `subscription_plan` |
| `ProductSubscription` | Per-product recurring | Product + Variant |

**2. Discount Hierarchy**
Discounts cascade from tenant defaults to product overrides:
```
Tenant Defaults (Settings → Subscriptions)
    └── Product Override (Product Detail Widget)
         └── Customer sees effective discount
```

If a product has `override_discounts.monthly = 15`, that overrides the tenant's `monthly_discount_percent = 10`.

**3. Product Metadata Storage**
Subscribe & Save config is stored in product metadata, not a separate table:
```json
{
  "subscribe_and_save": {
    "enabled": true,
    "frequencies": [...],
    "override_discounts": { "monthly": 15 }
  }
}
```

This avoids schema changes and migrations for adding S&S to products.

### Key Implementation Details

**Service Methods Added to SubscriptionModuleService:**
- `createProductSubscription()` - Create new S&S subscription
- `recordProductDelivery()` - Update dates after delivery
- `pauseProductSubscription()` / `resumeProductSubscription()` / `cancelProductSubscription()`
- `skipNextDelivery()` - Move next delivery date forward one interval
- `updateProductSubscriptionFrequency()` - Customer changes their frequency
- `getOverdueProductSubscriptions()` - For renewal job

**Renewal Job Pattern:**
The `subscribe-save-renewals.ts` job runs hourly and:
1. Iterates through all active tenants
2. Checks if tenant has S&S enabled (`config.subscription_defaults.enabled`)
3. Processes overdue subscriptions
4. Auto-resumes paused subscriptions when `pause_end` is reached

```typescript
// Check tenant has S&S enabled before processing
const subscriptionDefaults = config.subscription_defaults || {}
if (!subscriptionDefaults.enabled) {
  continue  // Skip this tenant
}
```

### Common Gotchas

1. **Store endpoint needs tenant context**: The `/store/products/:id/subscription-options` endpoint needs tenant context to fetch tenant defaults. Make sure tenant middleware runs first.

2. **Discount calculation on frontend**: The store endpoint returns `discount_percent`, not calculated prices. The frontend must calculate discounted prices based on variant prices.

3. **Frequency enabled check**: Each frequency (weekly, monthly, yearly) can be individually enabled/disabled per product. Always check `freq.enabled` before showing option.

---

## Per-Tenant Payment Gateway Configuration (Dec 30, 2025)

### Overview
Implemented Shopify-style payment gateway management where each tenant configures their own payment providers with encrypted credentials.

### Encryption Implementation

**AES-256-GCM with Combined Format:**
```typescript
// Encrypt returns: iv (12 bytes) + authTag (16 bytes) + ciphertext
// Stored as base64 string: "iv:authTag:ciphertext"

function encryptToString(plaintext: string): string {
  const result = encrypt(plaintext)
  const ivB64 = result.iv.toString('base64')
  const authTagB64 = result.authTag.toString('base64')
  const ciphertextB64 = result.ciphertext.toString('base64')
  return `${ivB64}:${authTagB64}:${ciphertextB64}`
}
```

**Why combined format?**
- Original design used separate IV field per credential
- Combined format is cleaner - single string per credential
- Easier to store in JSONB without extra fields

### Gateway-Specific Encryption Functions

Each gateway type has its own encrypt/decrypt functions:
- `encryptStripeCredentials()` / `decryptStripeCredentials()`
- `encryptPayPalCredentials()` / `decryptPayPalCredentials()`
- `encryptAuthorizeNetCredentials()` / `decryptAuthorizeNetCredentials()`

**Public vs Private Keys:**
```typescript
// Stripe: publishable_key is NOT encrypted (shown to customers)
{
  api_key_encrypted: "...",           // Encrypted
  webhook_secret_encrypted: "...",    // Encrypted
  publishable_key: "pk_live_...",     // Plain text (public)
}
```

### Provider Factory Pattern

The `getBillingProviderForTenant()` function:
1. Checks if tenant has configured the requested provider
2. Decrypts credentials if configured
3. Falls back to environment variables if not

```typescript
export function getBillingProviderForTenant(
  providerId: string,
  tenantConfig?: TenantConfig | null
): AbstractBillingProvider {
  const config = getProviderConfigForTenant(providerId, tenantConfig)
  return new BILLING_PROVIDERS[providerId](config)
}
```

### Sandbox Mode Detection

For Stripe, sandbox mode is auto-detected from API key prefix:
```typescript
sandbox_mode: credentials.api_key.startsWith("sk_test_")
```

For PayPal and Authorize.net, it's explicitly set during configuration.

### Common Gotchas

1. **ENCRYPTION_KEY must be 32 bytes**: AES-256 requires exactly 32-byte key. Generate with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **Decryption fails silently on wrong key**: If ENCRYPTION_KEY changes, all encrypted credentials become unreadable. Log decryption failures clearly.

3. **Gateway configuration is tenant-scoped**: The `/admin/tenants/:slug/payment-gateways` endpoints require tenant access check - only super admins and tenant owners can configure.

4. **Store endpoint returns public keys only**: The `/store/payment-gateways` endpoint never returns encrypted fields - only gateway IDs, names, and public keys (like Stripe publishable key).

### Admin UI Considerations

**Form validation per gateway:**
- Stripe: Requires `api_key` (sk_) and `publishable_key` (pk_), optional `webhook_secret`
- PayPal: Requires `client_id` and `client_secret`, optional `sandbox_mode`
- Authorize.net: Requires `api_login_id` and `transaction_key`, optional `signature_key`
- Manual: No configuration needed

**Masked key display:**
```typescript
function maskKey(key: string): string {
  if (key.length <= 8) return "•••"
  return key.slice(0, 7) + "..." + key.slice(-4)
}
// "sk_live_abcdefghijklmnop" → "sk_live...mnop"
```

---

## Medusa Admin Settings Sidebar (Dec 30, 2025)

### How to Add Pages to Settings Sidebar

Pages under `src/admin/routes/settings/*/page.tsx` automatically appear in the Settings sidebar when they export a `defineRouteConfig` with a `label`.

**Key insight**: The path structure matters. Pages in `src/admin/routes/settings/` are treated as settings pages and use the settings layout.

### Implementation Pattern

```typescript
// src/admin/routes/settings/custom/page.tsx
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading } from "@medusajs/ui"

const CustomSettingPage = () => {
  return (
    <Container className="p-8">
      <Heading level="h1">Custom Setting</Heading>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Custom Setting",  // This appears in sidebar
})

export default CustomSettingPage
```

### Common Gotchas

1. **Route config must be named `config`**: Export must be `export const config = ...`, not `export const routeConfig`.

2. **Label is required for sidebar**: Without `label`, the page won't appear in the sidebar navigation.

3. **Settings pages don't need `icon`**: Unlike main nav items, settings sidebar items don't display icons (design convention).

4. **Server restart may be needed**: After adding `defineRouteConfig`, a dev server restart ensures the route config is picked up.

5. **Settings pages use settings layout**: They automatically get the settings header with back arrow, don't need to implement your own.

### Non-Settings Routes

For routes that appear in the main sidebar (not settings), use `defineRouteConfig` with an icon:

```typescript
// src/admin/routes/subscriptions/page.tsx
import { CreditCard } from "@medusajs/icons"

export const config = defineRouteConfig({
  label: "Subscriptions",
  icon: CreditCard,  // Shows in main sidebar
})
```

For nested routes under existing nav items, use `nested`:

```typescript
export const config = defineRouteConfig({
  label: "Custom Orders",
  nested: "/orders",  // Appears under Orders in sidebar
})
```

---

## Payment Charging for Subscriptions (Dec 30, 2025)

### Overview
Implemented `chargePaymentMethod()` for both Stripe and Authorize.net billing providers to enable automatic recurring billing for Subscribe & Save subscriptions.

### Key Architecture Decisions

**1. Off-Session Charging (Not Stripe Subscriptions API)**
We chose NOT to use Stripe's Subscriptions API because:
- Stripe Subscriptions require Stripe Products and Prices, which would duplicate our product catalog
- More flexibility with our own scheduling and discount logic
- Easier to support multiple payment providers (Authorize.net)

Instead, we use Stripe PaymentIntents with `off_session: true`:
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: amount,
  currency: currency,
  customer: customerId,
  payment_method: paymentMethodId,
  off_session: true,  // Customer not present
  confirm: true,       // Immediately confirm/charge
})
```

**2. Authorize.net Uses CIM, Not ARB**
Authorize.net has two recurring billing systems:
- **ARB (Automated Recurring Billing)**: Authorize.net manages the schedule, inflexible
- **CIM (Customer Information Manager)**: Store payment profiles, charge on our schedule

We use CIM because:
- Same flexibility as Stripe approach
- We control the schedule with our renewal job
- Can handle variable discounts per renewal

**3. ChargeResult Interface**
Both providers return a normalized result:
```typescript
interface ChargeResult {
  success: boolean
  transactionId?: string
  error?: string
  errorCode?: string
  requiresAction?: boolean  // For 3DS (Stripe only)
  actionUrl?: string
}
```

### Common Gotchas

1. **Stripe 3DS on Saved Cards**: Cards saved in Europe may require 3DS even for off-session payments. Handle `authentication_required` error.

2. **Authorize.net BOM**: Authorize.net sometimes returns JSON with a BOM character. Always clean: `response.replace(/^\uFEFF/, "")`.

3. **Amount Units**: Stripe uses cents (integer), Authorize.net uses dollars (decimal).

4. **Currency Case**: Stripe requires lowercase currency codes.

---

## Customer Product Subscription Portal (Dec 30, 2025)

### Overview
Created complete API for customers to manage their Subscribe & Save subscriptions from the storefront.

### Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/store/product-subscriptions/me` | List all subscriptions |
| GET | `/store/product-subscriptions/me/:id` | Get details |
| POST | `/store/product-subscriptions/me/:id/pause` | Pause with optional resume date |
| POST | `/store/product-subscriptions/me/:id/resume` | Resume paused |
| POST | `/store/product-subscriptions/me/:id/cancel` | Cancel with optional reason |
| POST | `/store/product-subscriptions/me/:id/skip` | Skip next delivery |
| PATCH | `/store/product-subscriptions/me/:id/frequency` | Change frequency |

### Key Implementation Details

**Direct PostgreSQL vs SubscriptionModuleService:**
These endpoints use direct pg queries because ProductSubscription is in tenant schema, not public. The module service isn't tenant-aware for direct queries.

**Frequency Change Updates Discount:**
When customer changes frequency, we fetch tenant defaults and apply the new discount automatically.

**Skip vs Pause:**
Skip moves next delivery forward by one interval without pausing. Pause stops deliveries entirely until resumed.

---

## Frontend Integration Lessons (Drinkyum Storefront) - Jan 2, 2026

### Prices Are Stored in Cents
Medusa stores all prices in cents (minor units). When displaying prices on the frontend:
```typescript
// WRONG - displays "7000"
<span>{product.variants[0].prices[0].amount}</span>

// CORRECT - displays "$70.00"
const priceInCents = product.variants[0].prices[0].amount
const formatted = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(priceInCents / 100)
```

### React 19 useEffect Behavior
In development mode with React 19, `useEffect` runs twice (Strict Mode). This causes duplicate API calls. Don't be alarmed - this is expected behavior in dev mode and doesn't happen in production.

### Hydration Mismatches with API Data
Server-rendered pages show fallback/placeholder data, but client-side fetches replace it with API data. This can cause React hydration errors.

**Solution**: Use `useEffect` for client-only data fetching, or use Next.js data fetching patterns (`getServerSideProps`/server components) for SSR.

### Cart ID Persistence
The Medusa cart ID must persist across browser sessions. Store it in `localStorage`:
```typescript
const CART_ID_KEY = 'medusa_cart_id'

// On cart creation
localStorage.setItem(CART_ID_KEY, cart.id)

// On page load
const savedCartId = localStorage.getItem(CART_ID_KEY)
if (savedCartId) {
  // Fetch existing cart
}
```

**Gotcha**: Cart IDs can become invalid (expired, deleted). Handle 404 responses by creating a new cart:
```typescript
try {
  const cart = await fetchCart(savedCartId)
} catch (error) {
  if (error.status === 404) {
    localStorage.removeItem(CART_ID_KEY)
    // Create new cart
  }
}
```

### X-Tenant-ID Header is Critical
Every API request to the Medusa backend MUST include the `X-Tenant-ID` header. Without it, requests will fail or return wrong tenant data.

```typescript
// In your API client
const headers: HeadersInit = {
  'Content-Type': 'application/json',
  'X-Tenant-ID': process.env.NEXT_PUBLIC_TENANT_SLUG || 'drinkyum',
}
```

### Graceful Fallbacks for Empty Tenant Data
New tenants may not have products, collections, or other data configured yet. Always provide fallback content:

```typescript
const [products, setProducts] = useState<Product[]>(fallbackProducts)

useEffect(() => {
  async function load() {
    const apiProducts = await getProducts()
    if (apiProducts.length > 0) {
      setProducts(apiProducts)  // Only replace if API has data
    }
    // Otherwise keep fallback products
  }
  load()
}, [])
```

### Product Images May Not Exist
Products uploaded via admin may not have images. Always provide a fallback image:

```typescript
<Image
  src={product.thumbnail || product.images?.[0]?.url || '/images/placeholder.jpg'}
  alt={product.title}
/>
```

### CDN URL Rewriting
The backend stores relative image URLs (`/cdn/products/abc.jpg`). The frontend must rewrite these to the actual S3 URL using Next.js rewrites:

```typescript
// next.config.ts
async rewrites() {
  return [{
    source: '/cdn/:path*',
    destination: `https://s3-bucket.s3.amazonaws.com/${tenantSlug}/:path*`,
  }]
}
```

### Reusable Account Layout Pattern
For account pages with consistent sidebar navigation, create a shared layout component:

```typescript
// src/components/account/AccountLayout.tsx
export function AccountLayout({ children, title, description }) {
  const { isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Auth protection
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`)
    }
  }, [isAuthenticated, isLoading])

  return (
    <div className="flex">
      <AccountSidebar />
      <main>{children}</main>
    </div>
  )
}
```

### Auth Pages URL State Management
Auth pages should preserve `returnUrl` for post-login redirect:

```typescript
// In login page
const searchParams = useSearchParams()
const returnUrl = searchParams.get("returnUrl") || "/account"

// After successful login
router.push(returnUrl)
```

### CartContext vs AuthContext Method Naming
Be careful with context method names - they can differ between projects:

```typescript
// Some projects use:
const { addItem, isAdding } = useCart()

// Others use:
const { addToCart, isLoading: cartLoading } = useCart()

// Always check the actual context implementation
```

### Context Providers Must Wrap App
Cart and Auth contexts must be available throughout the app. Create a Providers wrapper:

```typescript
// src/components/Providers.tsx
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        {children}
      </CartProvider>
    </AuthProvider>
  )
}

// src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

### Variant Selection for Add to Cart
Medusa requires a `variant_id` for add to cart, not `product_id`. Products always have at least one variant:

```typescript
// Get the first variant (or let user select)
const variantId = product.variants[0]?.id
if (!variantId) {
  throw new Error('Product has no variants')
}
await addToCart(variantId, quantity)
```

### Common Gotchas

1. **Empty cart after refresh**: Cart ID not persisted to localStorage
2. **Wrong prices displayed**: Not dividing by 100 (cents to dollars)
3. **API returns empty array**: Tenant has no data - show fallbacks
4. **CORS errors**: Backend STORE_CORS doesn't include frontend domain
5. **401 on store routes**: Missing or invalid X-Tenant-ID header
6. **Images 404**: CDN rewrites not configured in next.config.ts
7. **Cart not updating in navbar**: Not using CartContext globally

---

## Payment Gateway Testing (Jan 2, 2026)

### Authorize.net Sandbox vs Production - CRITICAL

Authorize.net sandbox and production are **completely separate accounts** with different credentials:

| Environment | Portal URL | API Endpoint |
|-------------|------------|--------------|
| **Sandbox** | `sandbox.authorize.net` | `https://apitest.authorize.net/xml/v1/request.api` |
| **Production** | `new.authorize.net` | `https://api.authorize.net/xml/v1/request.api` |

**Common error**: Using production credentials with sandbox mode enabled (or vice versa) returns E00007 "User authentication failed".

**Solution**:
- If testing with sandbox mode, create a separate sandbox account at `sandbox.authorize.net`
- Sandbox credentials do NOT work on production endpoints
- Production credentials do NOT work on sandbox endpoints

### Test Connection Without Transactions

To validate Authorize.net credentials without making charges, use `authenticateTestRequest`:

```typescript
const requestBody = {
  authenticateTestRequest: {
    merchantAuthentication: {
      name: apiLoginId,
      transactionKey: transactionKey,
    },
  },
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(requestBody),
})

// Check response.messages.resultCode === "Ok"
```

This only validates credentials - no transactions, no test charges, no account modifications.

### Authorize.net JSON Response BOM

Authorize.net sometimes returns JSON with a BOM (Byte Order Mark) character. Always clean it:

```typescript
const text = await response.text()
const cleanText = text.replace(/^\uFEFF/, "")
const data = JSON.parse(cleanText)
```

### Tenant Slug vs Domain Name

A tenant's slug doesn't have to match its domain. Example:
- **Tenant slug**: `yum`
- **Domain**: `drinkyum.com`
- **API domain**: `api.drinkyum.com`

The frontend uses `NEXT_PUBLIC_TENANT_SLUG=yum` in the `X-Tenant-ID` header, while the domain is completely independent.

---

## Publishable API Key Tenant Isolation (Jan 2-3, 2026)

### The Problem

Medusa's `ensurePublishableApiKeyMiddleware` runs BEFORE custom middlewares in the Express chain. This causes tenant-specific publishable API keys to fail validation because:

1. Medusa registers built-in middlewares via `app.use()` in framework's `router.js` (lines 93-97)
2. Custom middlewares are registered AFTER (line 114)
3. Without tenant context, the publishable key lookup queries the `public` schema instead of the tenant schema

**Error you'll see:**
```json
{
  "type": "not_allowed",
  "message": "A valid publishable key is required to proceed with the request."
}
```

### Why Secret API Keys Work But Publishable Keys Don't

| Middleware | Registration | Tenant Context? |
|------------|--------------|-----------------|
| `ensurePublishableApiKeyMiddleware` | `app.use("/store", ...)` in router.js:93 | ❌ No - runs FIRST |
| `authenticate` (for secret keys) | After custom middlewares | ✅ Yes - runs AFTER tenant middleware |

Secret API keys work because they're validated by `authenticate` middleware, which runs AFTER custom middlewares have set tenant context.

### The Solution: Patch the Middleware at Startup

Since we can't change the registration order, we patch the middleware function itself at startup using require hooks and cache patching.

**Key insight**: Node.js caches required modules. By patching the require cache, we can intercept and wrap the middleware before Medusa uses it.

```typescript
// src/instrumentation.ts
export function patchPublishableKeyMiddleware(): void {
  const Module = require('module')
  const pathModule = require('path')

  // Build path manually - can't use require.resolve with package subpaths
  const frameworkPath = require.resolve('@medusajs/framework')
  const frameworkDir = pathModule.dirname(frameworkPath)
  const middlewarePath = pathModule.join(frameworkDir, 'http', 'middlewares', 'ensure-publishable-api-key.js')

  // Try to patch from cache (module already loaded)
  if (require.cache[middlewarePath]) {
    const cachedModule = require.cache[middlewarePath]
    const originalMiddleware = cachedModule.exports.ensurePublishableApiKeyMiddleware

    if (originalMiddleware && !originalMiddleware._tenantPatched) {
      cachedModule.exports.ensurePublishableApiKeyMiddleware = createTenantAwareMiddleware(originalMiddleware)
      cachedModule.exports.ensurePublishableApiKeyMiddleware._tenantPatched = true
    }
  }

  // Also hook future requires
  const originalRequire = Module.prototype.require
  Module.prototype.require = function(id: string) {
    const result = originalRequire.apply(this, arguments)

    if (id.includes('ensure-publishable-api-key') && result.ensurePublishableApiKeyMiddleware) {
      if (!result.ensurePublishableApiKeyMiddleware._tenantPatched) {
        result.ensurePublishableApiKeyMiddleware = createTenantAwareMiddleware(result.ensurePublishableApiKeyMiddleware)
        result.ensurePublishableApiKeyMiddleware._tenantPatched = true
      }
    }

    return result
  }
}
```

**The tenant-aware wrapper:**
```typescript
function createTenantAwareMiddleware(originalMiddleware: any) {
  const wrapped = async function(req: any, res: any, next: any) {
    const tenantSlug = req.headers?.['x-tenant-id'] || parseCookies(req.headers?.cookie)['x-tenant-id']

    if (!tenantSlug) {
      return originalMiddleware(req, res, next)  // Use public schema
    }

    // Resolve tenant and set search_path BEFORE validation
    const tenant = await resolveTenantBySlugDirect(tenantSlug)

    if (tenant?.schemaName && tenant.schemaName !== 'public') {
      const pgConnection = req.scope?.resolve(ContainerRegistrationKeys.PG_CONNECTION)
      if (pgConnection) {
        await pgConnection.raw(`SET search_path TO "${tenant.schemaName}", public`)
      }
    }

    req.tenant = tenant
    return runWithTenant(tenant, () => originalMiddleware(req, res, next))
  }

  wrapped._tenantPatched = true
  return wrapped
}
```

### Critical Gotcha: Package Subpath Exports

The @medusajs/framework package.json doesn't export internal middleware files. You CANNOT use:
```typescript
// THIS FAILS:
require.resolve('@medusajs/framework/dist/http/middlewares/ensure-publishable-api-key')
// Error: Package subpath './dist/http/middlewares/ensure-publishable-api-key' is not defined by "exports"
```

**Solution**: Build the path manually:
```typescript
const frameworkPath = require.resolve('@medusajs/framework')
const frameworkDir = pathModule.dirname(frameworkPath)
const middlewarePath = pathModule.join(frameworkDir, 'http', 'middlewares', 'ensure-publishable-api-key.js')
```

### Database Change: API Keys Must Stay in Tenant Schema

For tenant-specific publishable API keys to work, the `api_key` and `publishable_api_key_sales_channel` tables must NOT be in the EXCLUDED_TABLES list during tenant schema creation:

```typescript
// src/api/admin/tenants/route.ts
const EXCLUDED_TABLES = [
  'tenants',
  'mikro_orm_migrations',
  'script_migrations',
  'user',
  'auth_identity',
  'provider_identity',
  'invite',
  'user_tenant_assignments',
  // NOTE: api_key and publishable_api_key_sales_channel are NOT excluded.
  // They are tenant-specific.
]
```

### Verification

After implementation, logs should show:
```
[tenant-instrumentation] Patched ensurePublishableApiKeyMiddleware (from cache)
[tenant-instrumentation] Resolved tenant: yum -> schema tenant_yum
[tenant-instrumentation] Set search_path to tenant_yum on scoped connection
```

And API calls should succeed:
```bash
curl -X GET 'https://admin.radicalz.io/store/products' \
  -H 'x-publishable-api-key: pk_8a1c...' \
  -H 'x-tenant-id: yum'
# Returns: {"products":[],"count":0,"offset":0,"limit":50}
```

### Key Files

| File | Purpose |
|------|---------|
| `src/instrumentation.ts` | Patches pg Client and publishable key middleware at startup |
| `src/api/admin/tenants/route.ts` | Excludes api_key from EXCLUDED_TABLES |
| `medusa-config.ts` | Imports instrumentation at startup |

### Summary

To make tenant-specific publishable API keys work in Medusa 2.0 multi-tenant:
1. Patch the publishable key middleware at startup
2. Resolve tenant and set search_path BEFORE the original middleware runs
3. Keep api_key tables in tenant schemas (don't exclude during schema copy)
4. Build middleware paths manually to avoid package.json exports restrictions

---

## Bulk Product Editor with Handsontable (Jan 2, 2026)

### Overview
Ported the Bulk Product Editor from the old single-tenant project to the multi-tenant setup. Uses Handsontable for spreadsheet-style editing of products.

### Key Implementation Details

**Dependencies:**
- `handsontable`: ^15.2.0
- `@handsontable/react`: ^15.2.0

**Dark Mode CSS Injection:**
Handsontable doesn't natively support Medusa's dark mode. Solution: inject dark mode styles dynamically:

```typescript
useEffect(() => {
  const styleId = "handsontable-dark-mode"
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style")
    style.id = styleId
    style.textContent = `
      .dark .handsontable, .dark .handsontable td, .dark .handsontable th {
        background-color: #1f2937 !important;
        color: #e5e7eb !important;
        border-color: #374151 !important;
      }
      /* ... more dark mode styles */
    `
    document.head.appendChild(style)
  }
}, [])
```

**Image Manager Modal Pattern:**
For handling images in both existing and new products:

1. **Existing Products**: Images are uploaded directly to S3 and saved via API
2. **New Products**: Images are stored temporarily in the spreadsheet cell data until the row is saved

```typescript
// For new products, update spreadsheet cell directly
const updateSpreadsheetCell = (rowIndex: number, column: string, value: any) => {
  if (hotRef.current?.hotInstance) {
    const colIndex = columns.findIndex(c => c.data === column)
    if (colIndex !== -1) {
      hotRef.current.hotInstance.setDataAtCell(rowIndex, colIndex, value)
    }
  }
}
```

**New Product Row Pattern:**
Add an empty row at the bottom for creating new products:

```typescript
const createEmptyRow = () => ({
  id: "",
  title: "",
  handle: "",
  status: "draft",
  thumbnail: "",
  // ... other fields initialized to empty/default
  isNew: true,  // Flag to identify new rows
})

// Append to data
const tableData = [...flattenProducts(products), createEmptyRow()]
```

**Cell Click Detection for Image Modal:**
Handle clicks on thumbnail/image cells to open the image manager:

```typescript
const handleAfterOnCellMouseDown = (event: MouseEvent, coords: { row: number; col: number }) => {
  const columnName = columns[coords.col]?.data
  if (columnName !== "thumbnail" && columnName !== "images") return

  const isNewRow = coords.row === products.length
  if (isNewRow) {
    setSelectedProduct({
      id: "",
      title: "New Product",
      thumbnail: null,
      images: [],
    })
  } else {
    setSelectedProduct(products[coords.row])
  }
  setSelectedRowIndex(coords.row)
  setShowImageModal(true)
}
```

### Common Gotchas

1. **Handsontable License**: Free for non-commercial use. Commercial use requires a license key via `licenseKey` prop.

2. **Column Widths in Medusa Layout**: Use `width: "100%"` on container and let columns auto-size or set fixed widths.

3. **React Strict Mode**: Handsontable may render twice in development due to Strict Mode. This is expected behavior.

4. **Tenant Context for API Calls**: All product API calls must include the `x-tenant-id` cookie. The bulk editor reads this from `document.cookie`.

5. **Image URLs are Relative**: Stored as `/cdn/products/...`, displayed via S3 presigned URLs or CDN rewrites.

---

## Per-Tenant Email Configuration (Jan 2, 2026)

### Overview
Implemented Email Settings admin page allowing tenant owners to configure email providers and sender details through the UI.

### Email Provider Architecture

**Three supported providers:**
| Provider | Env Var | Best For |
|----------|---------|----------|
| AWS SES | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | High volume, cost-effective |
| SendGrid | `SENDGRID_API_KEY` | Developer-friendly, analytics |
| Resend | `RESEND_API_KEY` | Modern API, React email templates |

**Global vs Per-Tenant Credentials:**
- Credentials (API keys) are stored in **global environment variables**
- Per-tenant config stores only: provider selection, sender email, sender name, SES region

This design lets the platform owner manage one set of API keys while tenants customize their sending identity.

### Email Config Storage

Stored in `public.tenants.email_config` JSONB column:
```json
{
  "provider": "ses",
  "sender_email": "orders@mystore.com",
  "sender_name": "My Store",
  "ses_region": "us-east-1",
  "status": "verified"
}
```

### Provider Auto-Detection

The `email-providers.ts` library auto-detects available providers from environment:
```typescript
export function getDefaultProvider(): EmailProvider {
  if (process.env.SENDGRID_API_KEY) return "sendgrid"
  if (process.env.RESEND_API_KEY) return "resend"
  if (process.env.AWS_ACCESS_KEY_ID) return "ses"
  return "sendgrid" // Default fallback
}
```

### Key Implementation Details

**Unified Send Function:**
```typescript
// src/lib/email-providers.ts
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  switch (params.provider) {
    case "sendgrid": return sendViaSendGrid(params)
    case "resend": return sendViaResend(params)
    case "ses": return sendViaSES(params)
  }
}
```

**Test Email Endpoint:**
The `/admin/tenants/:slug/email/test` endpoint validates configuration by sending a formatted test email. Returns message ID on success.

### Common Gotchas

1. **AWS SES Sandbox Mode**: New AWS accounts start in sandbox mode where you can only send to verified emails. Request production access before go-live.

2. **Sender Verification Required**: All providers require sender email verification before sending:
   - SES: Verify in AWS Console → SES → Verified Identities
   - SendGrid: Domain authentication in Settings → Sender Authentication
   - Resend: Domain verification in Dashboard → Domains

3. **SES Region Matters**: SES is region-specific. If credentials are for `us-east-1`, you must use that region in the config.

4. **Error Messages Vary by Provider**: Each provider returns different error formats. The `email-providers.ts` normalizes these to `{ success, messageId?, error? }`.

5. **Settings Sidebar Placement**: Pages in `src/admin/routes/settings/*/page.tsx` automatically appear in Settings sidebar - no manual registration needed.
