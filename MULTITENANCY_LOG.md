# Multi-Tenant MedusaJS 2.0 Implementation Log

## Project Overview
Building a multi-tenant e-commerce backend using MedusaJS 2.0 with PostgreSQL schema-per-tenant isolation, deployed on Railway.

**Production URL:** https://medusa-backend-production-bc63.up.railway.app

---

## Architecture Decision

After evaluating three approaches:
- **Option A:** Separate deployments per tenant (too expensive, hard to manage)
- **Option B:** Soft multi-tenancy with tenant_id columns (limited isolation, complex queries)
- **Option C:** Schema-per-tenant isolation (chosen)

We chose **Option C: Schema-per-tenant isolation** because:
- Complete data isolation between tenants
- Each tenant gets their own PostgreSQL schema with all Medusa tables
- Single deployment serves all tenants
- Uses `SET search_path` to switch between tenant data

---

## Implementation Summary

### 1. Tenant Registry Table
Created `public.tenants` table to track all tenants:
```sql
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  schema_name VARCHAR(63) UNIQUE NOT NULL,
  domain VARCHAR(255),
  config JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. User-Tenant Assignments Table (Phase 7)
Created `public.user_tenant_assignments` for Klaviyo-style multi-tenant access:
```sql
CREATE TABLE public.user_tenant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  tenant_slug VARCHAR(50) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',  -- admin, editor, viewer
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by TEXT REFERENCES public."user"(id),
  UNIQUE(user_id, tenant_slug)
);
```

### 3. Files Created/Modified

#### Core Tenant Infrastructure

**`src/lib/tenant-context.ts`**
- AsyncLocalStorage-based tenant context
- `runWithTenant(tenant, callback)` - runs code in tenant context
- `getCurrentTenant()` - retrieves current tenant from context

**`src/lib/tenant-resolver.ts`**
- Resolves tenant from X-Tenant-ID header, cookie, or subdomain
- Queries `public.tenants` table to validate tenant

**`src/api/middlewares/tenant.ts`**
- Express middleware that resolves tenant for each request
- Parses cookies for `x-tenant-id`
- Sets up tenant context via AsyncLocalStorage
- Bypass paths: `/admin/tenants`, `/health`, `/ready`

**`src/api/middlewares/tenant-db.ts`**
- Sets PostgreSQL `search_path` based on current tenant
- Uses Knex connection from Medusa container

**`src/modules/tenant-orm-extension.ts`**
- Monkey-patches MikroORM's PostgreSQL driver
- Intercepts `beginTransaction` and `execute` methods
- Automatically sets `search_path` for tenant isolation

**`src/loaders/tenant-db-loader.ts`**
- Medusa loader that initializes the ORM patching on startup

#### API Routes

**`src/api/tenants/route.ts`** (unauthenticated)
- `GET /tenants` - List all tenants
- `POST /tenants` - Create new tenant with:
  - Creates PostgreSQL schema
  - Copies all table structures from public schema
  - Initializes store record with tenant name
  - Copies currency reference data

**`src/api/admin/tenants/route.ts`** (kept for reference)
- Original authenticated version (not used due to Medusa auth)

#### Admin UI Components

**`src/admin/routes/stores/page.tsx`**
- Full-page tenant management
- Lists all tenants in a table
- Create new tenant form
- Switch active tenant (sets cookie)

**`src/admin/widgets/store-switcher.tsx`**
- Widget shown on Orders page
- Quick tenant switcher dropdown
- Create new tenant inline

#### Middleware Configuration

**`src/api/middlewares.ts`**
```typescript
export default defineMiddlewares({
  routes: [
    {
      matcher: '/store/*',
      middlewares: [tenantMiddleware, tenantDbMiddleware],
    },
    {
      matcher: '/admin/*',
      middlewares: [tenantMiddleware, tenantDbMiddleware],
    },
  ],
})
```

---

## Current State

### Database Schemas
| Schema | Store Name | Purpose |
|--------|-----------|---------|
| `public` | Medusa Store | Default/fallback tenant |
| `tenant_ivan_pleeh` | ivan pleeh | First test tenant |

### Verified Working
1. `/tenants` API returns tenant list
2. Database isolation verified - each schema has separate data
3. `SET search_path` correctly switches between tenant data
4. Admin UI loads tenant list from API
5. Cookie-based tenant selection (`x-tenant-id`)

### Test Results
```
PUBLIC schema store: [ { id: 'store_01KDE9FGN6NYSNF4Q7QVXQJEWW', name: 'Medusa Store' } ]
TENANT schema store: [ { id: 'store_43c3bec255af45eb9f178a3b', name: 'ivan pleeh' } ]
With search_path set to tenant: [ { id: 'store_43c3bec255af45eb9f178a3b', name: 'ivan pleeh' } ]
With search_path set to public: [ { id: 'store_01KDE9FGN6NYSNF4Q7QVXQJEWW', name: 'Medusa Store' } ]
```

---

## How It Works

### Request Flow
1. Request comes in with `x-tenant-id` cookie or header
2. `tenantMiddleware` resolves tenant from DB
3. `runWithTenant()` sets AsyncLocalStorage context
4. `tenantDbMiddleware` sets Knex search_path
5. MikroORM patch sets search_path for ORM queries
6. All DB queries automatically use tenant's schema

### Tenant Creation Flow
1. Admin creates tenant via `/admin/tenants` POST
2. New PostgreSQL schema created: `tenant_{slug}`
3. All tables copied from public schema (131 tables)
4. Store record initialized with tenant name
5. Essential reference data seeded:
   - Currencies (all 123 currencies with ALL columns)
   - Default Sales Channel (linked to store)
   - Payment Providers (pp_system_default)
   - Fulfillment Providers (manual_manual)
   - Default Region (United States/USD, linked to store)
   - Store Currencies (USD default, EUR, GBP, CAD, AUD linked via store_currency table)

---

## Admin Credentials

### Super Admin (Platform Owner)
- **Email:** admin@multistore.com
- **Password:** admin123
- **Role:** Super Admin (`is_super_admin: true`)
- **Access:** All tenants, tenant management, user assignment
- **URL:** https://medusa-backend-production-bc63.up.railway.app/app

### Super Admin 2
- **Email:** ivan@radicalz.io
- **Password:** (set during initial setup)
- **Role:** Super Admin (`is_super_admin: true`)

### Tenant Admin: Attack Dog + Ivan Pleeh (Multi-Tenant)
- **Email:** ivan+1@radicalz.io
- **Password:** AttackDog2024!
- **Role:** Multi-Tenant Admin
- **Access:**
  - `attack-dog` as `admin`
  - `ivan-pleeh` as `editor`
- **Created:** 2025-12-28
- **Note:** Can switch between stores via Store Switcher widget

---

## Environment Variables
```
DATABASE_URL=postgresql://postgres:xxx@mainline.proxy.rlwy.net:27327/railway
REDIS_URL=redis://default:xxx@...
TENANT_BASE_DOMAIN=store.example.com (optional, for subdomain routing)
```

---

## Known Limitations / TODO

1. **MikroORM patching** - Works but is a monkey-patch approach
2. **Migrations** - New tenant schemas don't auto-migrate; table structure copied at creation time
3. **Background jobs** - Need to ensure tenant context in async workflows
4. **API Keys** - Each tenant needs their own publishable API keys created
5. **Authentication** - Admin users are currently shared across tenants

---

## Deployment

Using Railway CLI:
```bash
railway up
```

Or via the MCP Railway tools for automated deployment.

---

## Date Log

- **2025-12-26**: Initial tenant table created, basic middleware
- **2025-12-27**:
  - Implemented schema-per-tenant isolation (Option C)
  - Created MikroORM driver patching
  - Added tenant DB middleware
  - Built admin UI for tenant management
  - Moved `/admin/tenants` to `/tenants` to bypass Medusa auth
  - Verified database isolation working correctly
- **2025-12-28**:
  - Implemented role-based access control system
  - Created `/admin/me/role` endpoint for user role info
  - Created `/admin/tenants/:slug/users` for user-tenant assignment
  - Added `tenantAdminContextMiddleware` to enforce tenant access
  - Updated Stores page and Store Switcher widget with access control
  - Created first tenant admin user for Attack Dog store
  - Discovered Medusa's 3-table auth system (user → auth_identity → provider_identity)
  - Learned password hashing uses `scrypt-kdf` library (NOT raw scrypt) with HMAC verification
  - **Phase 7: Multi-Tenant Admin Support**
    - Created `user_tenant_assignments` table for Klaviyo-style per-tenant roles
    - Updated `/admin/me/role` to return `tenants` array with roles
    - Updated middleware to allow multi-tenant admins to switch between assigned stores
    - Updated Store Switcher widget with 3 views: single-tenant, multi-tenant, super admin
    - Added `/admin/me` to bypass paths (uses public.user, not tenant schema)
  - **Store Currency Fix**
    - Discovered currencies weren't appearing in "Create Region" dropdown
    - Root cause: `store_currency` linking table was empty
    - Fixed by populating `store_currency` with USD (default), EUR, GBP, CAD, AUD for all stores
    - Updated tenant creation code to seed `store_currency` entries for new tenants
  - **Auth Tables Isolation Fix (Random Logout Bug)**
    - Discovered random logouts while browsing admin
    - Root cause: Empty auth tables (`user`, `auth_identity`, `provider_identity`, `invite`) existed in tenant schemas
    - PostgreSQL search_path found empty tenant tables instead of public tables with actual data
    - Fixed by dropping auth tables from existing tenant schemas
    - Updated `EXCLUDED_TABLES` to prevent copying auth tables to new tenants
- **2025-12-29**:
  - **S3 File Storage Implementation**
    - Created tenant-isolated file storage with per-tenant S3 prefixes
    - Built custom `TenantFileService` for dynamic prefix injection
    - Implemented `/admin/files/upload` and `/admin/files/presign` endpoints
    - Using relative URLs (`/cdn/...`) for SEO-friendly image serving
  - **Custom Admin Domain**
    - Set up `admin.radicalz.io` as unified admin domain (Shopify-style)
    - Fixed Dockerfile admin path mismatch (`.medusa/server/public/admin/` → `./public/admin/`)
  - **User & Role Management System (Phase 8)**
    - Implemented 4-tier role hierarchy: owner > admin > editor > viewer
    - Created super admin user management APIs (`/admin/users/*`)
    - Created tenant team management APIs (`/admin/team/*`)
    - Built Users page (`/app/users`) for super admin platform-wide user management
    - Built User Detail page (`/app/users/:id`) for managing individual user assignments
    - Built Team Panel widget for tenant owners/admins to manage their store team
    - Implemented permission enforcement: role hierarchy, self-protection, owner protection
    - Added RBAC utilities for both server (`rbac.ts`) and client (`lib/rbac.ts`)
    - Extended `use-user-role.ts` with `useCurrentTenantRole()`, `useCanManageTeam()`, `useCanChangeRoles()`

---

## Creating Admin Users Programmatically

### Medusa 2.0 Auth Architecture
Medusa uses a 3-table authentication system:

```
┌──────────────┐      ┌─────────────────┐      ┌────────────────────┐
│    user      │◄────▶│  auth_identity  │◄────▶│ provider_identity  │
├──────────────┤      ├─────────────────┤      ├────────────────────┤
│ id           │      │ id              │      │ id                 │
│ email        │      │ app_metadata:   │      │ entity_id (email)  │
│ metadata:    │      │   user_id ──────│──────│ provider           │
│  tenant_slug │      │                 │      │ auth_identity_id ──│
│  is_super_   │      │                 │      │ provider_metadata: │
│    admin     │      │                 │      │   password (hash)  │
└──────────────┘      └─────────────────┘      └────────────────────┘
```

### Password Hashing
Medusa uses the `scrypt-kdf` library with a specific 96-byte format:
- Bytes 0-5: "scrypt" prefix
- Byte 6: version (0)
- Byte 7: log2N (15 = N of 32768)
- Bytes 8-11: r parameter (8)
- Bytes 12-15: p parameter (1)
- Bytes 16-47: 32-byte salt
- Bytes 48-63: SHA256 checksum
- Bytes 64-95: HMAC-SHA256 hash

**Important**: Do NOT use raw `crypto.scrypt` - the format is completely different!

### Script to Create Tenant Admin
```javascript
const { Client } = require('pg');
const Scrypt = require('scrypt-kdf');
const crypto = require('crypto');

async function createTenantAdmin(email, password, tenantSlug) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const userId = 'user_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const authId = 'authid_' + crypto.randomUUID().replace(/-/g, '').slice(0, 26).toUpperCase();
  const providerId = crypto.randomUUID().replace(/-/g, '').slice(0, 26).toUpperCase();

  // 1. Create user with tenant assignment
  await client.query(
    `INSERT INTO public."user" (id, email, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())`,
    [userId, email, JSON.stringify({ tenant_slug: tenantSlug })]
  );

  // 2. Create auth_identity linked to user
  await client.query(
    `INSERT INTO public.auth_identity (id, app_metadata, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())`,
    [authId, JSON.stringify({ user_id: userId })]
  );

  // 3. Generate password hash using scrypt-kdf (REQUIRED!)
  const hash = await Scrypt.kdf(password, { logN: 15, r: 8, p: 1 });

  // 4. Create provider_identity with credentials
  await client.query(
    `INSERT INTO public.provider_identity
     (id, entity_id, provider, auth_identity_id, provider_metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    [providerId, email, 'emailpass', authId, JSON.stringify({ password: hash.toString('base64') })]
  );

  await client.end();
  console.log('Created tenant admin:', email, '→', tenantSlug);
}
```

---

## Recent Fixes (Dec 28, 2025)

### pg Client Instrumentation for Tenant Isolation
**Problem**: MikroORM queries were returning data from all tenants instead of the selected tenant.

**Root cause**: Medusa 2.0 uses MikroORM which bundles its own `pg` module. The middleware was setting `search_path` on the Knex connection, but MikroORM uses a separate connection pool.

**Solution**: Created `src/instrumentation.ts` that patches BOTH pg modules (main and MikroORM's nested) at startup:

```typescript
// Patch main pg module
const pg = require('pg')
patchPgClient(pg.Client, 'pg')

// Patch MikroORM's nested pg module
const mikroOrmPgPath = require.resolve('pg', {
  paths: [path.dirname(require.resolve('@mikro-orm/postgresql'))]
})
const mikroOrmPg = require(mikroOrmPgPath)
patchPgClient(mikroOrmPg.Client, 'mikro-orm-pg')
```

**Critical detail**: The patch runs `SET search_path` as a **separate query** before each data query. You CANNOT prepend multiple statements to a prepared statement in PostgreSQL - it will error with "cannot insert multiple commands into a prepared statement".

**Import in medusa-config.ts**:
```typescript
import './src/instrumentation'
```

**Gotchas discovered**:
1. Don't cache search_path per connection - pooled connections get reused across requests
2. Skip queries that already contain `search_path` to avoid infinite loops
3. Handle both callback and promise-based query patterns

---

## Files Structure
```
src/
├── instrumentation.ts            # pg Client patching for tenant isolation (CRITICAL)
├── admin/
│   ├── routes/
│   │   └── stores/
│   │       └── page.tsx          # Tenant management page
│   └── widgets/
│       └── store-switcher.tsx    # Quick tenant switcher
├── api/
│   ├── middlewares/
│   │   ├── tenant.ts             # Tenant resolution middleware
│   │   ├── tenant-db.ts          # Database search_path middleware
│   │   └── tenant-admin-context.ts  # Tenant enforcement for admins
│   ├── admin/
│   │   └── files/
│   │       ├── upload/route.ts   # File upload endpoint
│   │       └── presign/route.ts  # Presigned URL endpoint
│   ├── tenants/
│   │   └── route.ts              # Tenant CRUD API
│   └── middlewares.ts            # Middleware configuration
├── lib/
│   ├── tenant-context.ts         # AsyncLocalStorage context
│   └── tenant-resolver.ts        # Tenant lookup logic
├── modules/
│   └── tenant-file/
│       └── service.ts            # Tenant-aware S3 file service
├── loaders/
│   └── tenant-db-loader.ts       # Startup loader (deprecated - use instrumentation.ts)
└── modules/
    └── tenant-orm-extension.ts   # MikroORM patching (deprecated - use instrumentation.ts)
```

---

## S3 File Storage (Dec 29, 2025)

### Implementation Summary
Created tenant-isolated file storage using AWS S3 with per-tenant path prefixes.

### S3 Bucket
- **Name:** `medusa-multistore-assets`
- **Region:** `us-east-1`
- **IAM User:** `medusa-multistore-s3`
- **Public Access:** Enabled for image serving

### File Structure
```
s3://medusa-multistore-assets/
├── {tenant-slug}/
│   ├── products/           # Product images
│   └── files/              # Other uploads
└── public/                 # Fallback for no-tenant context
```

### URL Strategy (SEO-Friendly)
Instead of storing full S3 URLs, we store **relative URLs**:
- **Stored:** `/cdn/products/abc123.jpg`
- **Displayed:** `https://attackdog.com/cdn/products/abc123.jpg`
- **S3 Actual:** `https://medusa-multistore-assets.s3.us-east-1.amazonaws.com/attack-dog/products/abc123.jpg`

The Vercel frontend rewrites `/cdn/*` to the S3 URL with tenant prefix.

### API Endpoints
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/admin/files/upload` | POST | Required | Upload file (multipart/form-data) |
| `/admin/files/presign` | POST | Required | Get presigned URL for direct S3 upload |

### Upload Response Example
```json
{
  "file": {
    "id": "abc123def456",
    "url": "/cdn/products/abc123def456.jpg",
    "full_url": "https://medusa-multistore-assets.s3.us-east-1.amazonaws.com/attack-dog/products/abc123def456.jpg",
    "key": "attack-dog/products/abc123def456.jpg",
    "name": "product-photo.jpg",
    "size": 245678,
    "mime_type": "image/jpeg",
    "tenant": "attack-dog"
  }
}
```

### Presigned URL Response Example
```json
{
  "upload_url": "https://medusa-multistore-assets.s3.us-east-1.amazonaws.com/attack-dog/products/xyz789.jpg?X-Amz-Algorithm=...",
  "file": {
    "id": "xyz789",
    "url": "/cdn/products/xyz789.jpg",
    "full_url": "https://medusa-multistore-assets.s3.us-east-1.amazonaws.com/attack-dog/products/xyz789.jpg",
    "key": "attack-dog/products/xyz789.jpg",
    "tenant": "attack-dog"
  }
}
```

### Environment Variables (Railway)
```
S3_BUCKET=medusa-multistore-assets
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=AKIASRP6T5X2CHBJZRC5
S3_SECRET_ACCESS_KEY=***
S3_FILE_URL=https://medusa-multistore-assets.s3.us-east-1.amazonaws.com
```

### Dependencies Added
```json
{
  "@aws-sdk/client-s3": "^3.958.0",
  "@aws-sdk/s3-request-presigner": "^3.958.0",
  "express-fileupload": "^1.5.2"
}
```

### Vercel Frontend Configuration
Each tenant's Next.js app needs:
```javascript
// next.config.js
async rewrites() {
  return [{
    source: '/cdn/:path*',
    destination: `https://medusa-multistore-assets.s3.us-east-1.amazonaws.com/${process.env.TENANT_SLUG}/:path*`,
  }]
}
```

### Why Custom Service vs Medusa's File Module?
1. Medusa's `@medusajs/file-s3` doesn't support dynamic per-request prefixes
2. Tenant slug comes from AsyncLocalStorage, not config
3. Presigned URLs need tenant prefix baked in at generation time

---

## Custom Admin Domain (Dec 29, 2025)

### Implementation Summary
Set up `admin.radicalz.io` as the unified admin domain (Shopify-style architecture).

### Domain Setup
- **Domain:** `admin.radicalz.io`
- **DNS:** CNAME → `4gja94zd.up.railway.app`
- **SSL:** Automatic via Railway

### Configuration Changes

**medusa-config.ts:**
```typescript
admin: {
  backendUrl: "https://admin.radicalz.io",
  disable: process.env.DISABLE_ADMIN === "true",
},
```

**Railway Environment Variables:**
```
ADMIN_CORS=http://localhost:5173,http://localhost:9000,https://docs.medusajs.com,https://admin.radicalz.io
AUTH_CORS=http://localhost:5173,http://localhost:9000,https://docs.medusajs.com,https://admin.radicalz.io
MEDUSA_BACKEND_URL=https://admin.radicalz.io
```

### Critical Dockerfile Fix

Medusa's admin path mismatch required copying admin to correct location:

```dockerfile
# Build outputs to .medusa/server/public/admin/
# But medusa start looks for ./public/admin/
RUN mkdir -p /app/public && \
    cp -r /app/.medusa/server/public/admin /app/public/admin
```

**Root cause:** `@medusajs/admin-bundler` serve function uses `ADMIN_RELATIVE_OUTPUT_DIR = "./public/admin"` but build outputs to `.medusa/server/public/admin/`.

### Final Dockerfile
```dockerfile
FROM node:20-alpine

ENV NODE_OPTIONS="--max-old-space-size=4096"
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Build and copy admin to correct location
RUN npm run build && \
    mkdir -p /app/public && \
    cp -r /app/.medusa/server/public/admin /app/public/admin

EXPOSE 9000

CMD sh -c 'cd /app && npx medusa db:migrate && npx medusa start'
```

### URLs
| URL | Purpose |
|-----|---------|
| `https://admin.radicalz.io/app` | Admin panel |
| `https://admin.radicalz.io/health` | Health check |
| `https://admin.radicalz.io/store/*` | Store API |
| `https://admin.radicalz.io/admin/*` | Admin API |

### Architecture Decision
Following Shopify's model:
- **Unified admin domain** for all tenants (not per-tenant admin)
- **Per-tenant storefronts** on Vercel with custom domains
- Tenant switching via cookie (`x-tenant-id`) in admin panel

---

## Subscribe & Save System (Dec 30, 2025)

### Implementation Summary
Built a per-product subscription system allowing customers to subscribe for recurring delivery with frequency-based discounts.

### New Files Created

| File | Purpose |
|------|---------|
| `src/api/admin/tenants/[slug]/subscription-defaults/route.ts` | Tenant-level S&S defaults (GET/PATCH) |
| `src/api/admin/products/[id]/subscribe-save/route.ts` | Product-level S&S config (GET/POST/DELETE) |
| `src/api/store/products/[id]/subscription-options/route.ts` | Public endpoint for storefront |
| `src/admin/widgets/product-subscribe-save.tsx` | Product detail page widget |
| `src/admin/routes/settings/subscriptions/page.tsx` | Tenant S&S settings UI |
| `src/modules/subscription/models/product-subscription.ts` | ProductSubscription model |
| `src/modules/subscription/migrations/Migration20251230120000.ts` | Migration for product_subscription table |
| `src/jobs/subscribe-save-renewals.ts` | Hourly renewal processing job |

### Modified Files

| File | Changes |
|------|---------|
| `src/modules/subscription/models/index.ts` | Added ProductSubscription export |
| `src/modules/subscription/service.ts` | Added ProductSubscription CRUD methods |

### Data Model

**ProductSubscription Table:**
```sql
CREATE TABLE product_subscription (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  interval TEXT DEFAULT 'month',       -- week, month, year
  interval_count INTEGER DEFAULT 1,
  discount_percent INTEGER DEFAULT 0,
  unit_price INTEGER,
  currency_code TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'active',        -- active, paused, canceled, past_due
  next_delivery_date TIMESTAMPTZ NOT NULL,
  last_delivery_date TIMESTAMPTZ,
  shipping_address_id TEXT,
  payment_method_id TEXT,
  provider_id TEXT DEFAULT 'stripe',
  provider_payment_method_id TEXT,
  provider_customer_id TEXT,
  canceled_at TIMESTAMPTZ,
  pause_start TIMESTAMPTZ,
  pause_end TIMESTAMPTZ,
  metadata JSONB
);
```

### Service Methods Added

```typescript
// Product Subscriptions (Subscribe & Save)
createProductSubscription(data)
getProductSubscriptionById(id)
getActiveProductSubscriptions(customerId)
getCustomerProductSubscriptions(customerId)
hasActiveProductSubscription(customerId, productId, variantId)
recordProductDelivery(id)
pauseProductSubscription(id, resumeDate?)
resumeProductSubscription(id)
cancelProductSubscription(id)
markProductSubscriptionPastDue(id)
getProductSubscriptionsDueForDelivery(withinHours)
getOverdueProductSubscriptions()
getPausedProductSubscriptionsToResume()
updateProductSubscriptionFrequency(id, interval, intervalCount)
skipNextDelivery(id)
getProductSubscriptionStats()
```

### How It Works

1. **Tenant enables S&S** in Settings → Subscriptions
2. **Admin configures S&S** on individual products via product detail widget
3. **Storefront fetches options** via `/store/products/:id/subscription-options`
4. **Customer subscribes** - creates ProductSubscription record
5. **Renewal job** runs hourly, processes overdue subscriptions

---

## Per-Tenant Payment Gateway Configuration (Dec 30, 2025)

### Implementation Summary
Built Shopify-style payment gateway management where each tenant configures their own payment providers with AES-256-GCM encrypted credentials.

### New Files Created

| File | Purpose |
|------|---------|
| `src/lib/encryption.ts` | AES-256-GCM encryption module |
| `src/api/admin/tenants/[slug]/payment-gateways/route.ts` | Gateway list & configure |
| `src/api/admin/tenants/[slug]/payment-gateways/[gateway_id]/route.ts` | Enable/disable/delete gateway |
| `src/api/store/payment-gateways/route.ts` | Public gateway list for checkout |
| `src/admin/routes/settings/payments/page.tsx` | Payment settings UI |

### Modified Files

| File | Changes |
|------|---------|
| `src/modules/subscription/providers/index.ts` | Added tenant-aware provider factory |

### Encryption Module

**Key Functions:**
```typescript
// Core encryption
encrypt(plaintext: string): { iv, authTag, ciphertext }
decrypt(iv, authTag, ciphertext): string

// String format (iv:authTag:ciphertext)
encryptToString(plaintext): string
decryptFromString(combined): string

// Gateway-specific
encryptStripeCredentials(credentials): EncryptedGatewayConfig
decryptStripeCredentials(encrypted): StripeCredentials
encryptPayPalCredentials(credentials): EncryptedGatewayConfig
decryptPayPalCredentials(encrypted): PayPalCredentials
encryptAuthorizeNetCredentials(credentials): EncryptedGatewayConfig
decryptAuthorizeNetCredentials(encrypted): AuthorizeNetCredentials

// Utility
maskSensitiveValue(value, visibleStart, visibleEnd): string
isEncryptionConfigured(): boolean
```

### Tenant Config Structure

```typescript
{
  payment_gateways: {
    enabled_gateways: ["stripe", "paypal"],
    default_gateway: "stripe",
    gateways: {
      stripe: {
        api_key_encrypted: "iv:authTag:ciphertext",
        webhook_secret_encrypted: "iv:authTag:ciphertext",
        publishable_key: "pk_live_...",  // Not encrypted
        sandbox_mode: false,
        updated_at: "2025-12-30T..."
      }
    }
  },
  subscription_defaults: {
    enabled: true,
    weekly_discount_percent: 5,
    monthly_discount_percent: 10,
    yearly_discount_percent: 15
  }
}
```

### Provider Factory Functions

```typescript
// Get decrypted config for provider
getProviderConfigForTenant(providerId, tenantConfig): ProviderConfig

// Create provider instance with tenant credentials
getBillingProviderForTenant(providerId, tenantConfig): AbstractBillingProvider

// Check if gateway is enabled for tenant
isTenantGatewayEnabled(providerId, tenantConfig): boolean

// Get tenant's default gateway
getTenantDefaultGateway(tenantConfig): string | null
```

### Environment Variable

```bash
# Required for payment credential encryption (32 bytes base64)
ENCRYPTION_KEY=<base64-encoded-32-byte-key>
```

Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### API Endpoints Summary

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/admin/tenants/:slug/subscription-defaults` | GET | Get S&S defaults | Super Admin/Owner |
| `/admin/tenants/:slug/subscription-defaults` | PATCH | Update S&S defaults | Super Admin/Owner |
| `/admin/tenants/:slug/payment-gateways` | GET | List gateways (masked) | Super Admin/Owner |
| `/admin/tenants/:slug/payment-gateways` | POST | Configure gateway | Super Admin/Owner |
| `/admin/tenants/:slug/payment-gateways/:id` | PATCH | Enable/disable/default | Super Admin/Owner |
| `/admin/tenants/:slug/payment-gateways/:id` | DELETE | Remove gateway | Super Admin/Owner |
| `/admin/products/:id/subscribe-save` | GET | Get product S&S config | Admin |
| `/admin/products/:id/subscribe-save` | POST | Configure product S&S | Admin |
| `/admin/products/:id/subscribe-save` | DELETE | Disable product S&S | Admin |
| `/store/products/:id/subscription-options` | GET | Public S&S options | Public |
| `/store/payment-gateways` | GET | Public gateway list | Public |

### Admin UI Pages

**Settings → Subscriptions** (`/app/settings/subscriptions`)
- Enable/disable S&S globally
- Set default discount percentages
- "How It Works" guide

**Settings → Payments** (`/app/settings/payments`)
- Gateway cards with status
- Enable/disable toggles
- Configuration forms
- Set default gateway
- Sandbox mode indicators
- Remove gateway

**Product Detail Widget**
- Toggle S&S for product
- Select enabled frequencies
- Override discount percentages
- Shows effective discounts

### Settings Sidebar Configuration

Added `defineRouteConfig` to both settings pages for sidebar visibility:

```typescript
// Both pages export:
import { defineRouteConfig } from "@medusajs/admin-sdk"

export const config = defineRouteConfig({
  label: "Subscribe & Save",  // or "Payment Gateways"
})
```

**Settings sidebar now shows:**
- Subscribe & Save → `/app/settings/subscriptions`
- Payment Gateways → `/app/settings/payments`

**Key learning**: Pages under `src/admin/routes/settings/*/page.tsx` automatically appear in the Settings sidebar when they export a `config` with a `label`. No additional configuration needed.

---

## Frontend Integration (Drinkyum Storefront) - Jan 2, 2026

### Overview
Integrated the Next.js 16 storefront (`/Users/ivan/Drinkyum`) with the Medusa multistore backend, providing full e-commerce functionality with tenant isolation.

### New Files Created in Drinkyum

| File | Purpose |
|------|---------|
| `src/lib/medusa-client.ts` | API client with X-Tenant-ID header injection |
| `src/lib/auth.ts` | Customer authentication functions |
| `src/lib/cart.ts` | Cart management (create, add, update, remove) |
| `src/lib/checkout.ts` | Checkout flow functions |
| `src/lib/products.ts` | Product fetching from Medusa API |
| `src/lib/subscriptions.ts` | Subscribe & Save management |
| `src/lib/content.ts` | CMS/blog content fetching |
| `src/lib/analytics.ts` | Customer activity tracking |
| `src/lib/addresses.ts` | Address management |
| `src/lib/payments.ts` | Saved payment methods |
| `src/lib/orders.ts` | Order history fetching |
| `src/contexts/AuthContext.tsx` | Authentication state provider |
| `src/contexts/CartContext.tsx` | Cart state provider with localStorage |
| `src/components/Providers.tsx` | Context provider wrapper |

### Integration Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Drinkyum Storefront                          │
│                    (Next.js 16 + React 19)                       │
├──────────────────────────────────────────────────────────────────┤
│ CartContext  │  AuthContext  │  Products  │  Checkout  │  Account│
├──────────────┴───────────────┴────────────┴────────────┴─────────┤
│                       medusa-client.ts                           │
│              (X-Tenant-ID: "drinkyum" header)                    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                 Medusa Multistore Backend                        │
│               (admin.radicalz.io / Railway)                      │
├──────────────────────────────────────────────────────────────────┤
│  Tenant Middleware → SET search_path TO "tenant_drinkyum"        │
└──────────────────────────────────────────────────────────────────┘
```

### Environment Configuration

**`.env.local` in Drinkyum:**
```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://admin.radicalz.io
NEXT_PUBLIC_TENANT_SLUG=drinkyum
S3_FILE_URL=https://medusa-multistore-assets.s3.us-east-1.amazonaws.com
```

### Key Integration Patterns

**1. Tenant Header Injection:**
```typescript
// src/lib/medusa-client.ts
const headers: HeadersInit = {
  'Content-Type': 'application/json',
  'X-Tenant-ID': process.env.NEXT_PUBLIC_TENANT_SLUG || 'drinkyum',
}
```

**2. Graceful Fallback Pattern:**
All API-integrated pages fall back to hardcoded data when the API is unavailable:
```typescript
try {
  const apiProducts = await getProducts({ limit: 6 })
  if (apiProducts.length > 0) {
    setProducts(apiProducts)
  }
  // Keep fallback products if API returns empty
} catch (error) {
  console.error('Failed to fetch products:', error)
  // Fallback products already set as initial state
}
```

**3. CDN Rewrites (next.config.ts):**
```typescript
async rewrites() {
  return [{
    source: '/cdn/:path*',
    destination: `${process.env.S3_FILE_URL}/${process.env.NEXT_PUBLIC_TENANT_SLUG}/:path*`,
  }]
}
```

### Pages Integrated

| Page | Status | Notes |
|------|--------|-------|
| Homepage Products | ✅ API + Fallback | Uses `getProducts()` with fallback |
| Collections | ✅ API + Fallback | Uses `getCollections()` with fallback |
| Collection Detail | ✅ API + Fallback | Fetches collection products |
| Product Detail | ✅ API + Fallback | Includes subscription options |
| Cart Page | ✅ API + Fallback | Uses CartContext |
| Navbar Cart Count | ✅ | Real-time cart sync via context |
| Checkout | ⏳ Placeholder | Functions defined, needs Stripe integration |
| Account | ❌ Not Started | Login/register pages needed |

### Cart Context Implementation

```typescript
// src/contexts/CartContext.tsx
export function CartProvider({ children }) {
  const [cartId, setCartId] = useState<string | null>(null)
  const [items, setItems] = useState<CartItem[]>([])

  // Sync cart with Medusa API
  useEffect(() => {
    const savedCartId = localStorage.getItem('medusa_cart_id')
    if (savedCartId) {
      fetchCart(savedCartId)
    }
  }, [])

  const addToCart = async (variantId: string, quantity: number) => {
    // Create cart if needed, then add item
    // Updates context state after API call
  }
}
```

---

## Payment Gateway Test Connection (Jan 2, 2026)

### Overview
Added a "Test Connection" button to the Payment Gateways settings page that validates credentials against the payment provider's API without making any actual transactions.

### Implementation

**New Endpoint:** `POST /admin/tenants/:slug/payment-gateways/:gateway_id/test`

Tests gateway credentials by making a validation-only API call:
- **Authorize.net**: Uses `authenticateTestRequest` to validate API Login ID and Transaction Key
- **Stripe**: Fetches `/v1/balance` endpoint to verify API key validity
- **PayPal**: Not yet implemented
- **Manual**: Always returns success (no credentials to test)

### Key Files

| File | Purpose |
|------|---------|
| `src/api/admin/tenants/[slug]/payment-gateways/[gateway_id]/test/route.ts` | Test endpoint |
| `src/admin/routes/settings/payments/page.tsx` | Added Test Connection button and result display |

### API Response Format

```typescript
interface TestResult {
  success: boolean
  message: string
  gateway_id: string
  details?: {
    mode: "sandbox" | "production"
    endpoint?: string
    error_code?: string
  }
}
```

### Admin UI Updates

Added to the payment gateway card:
- **Test Connection** button (only visible for configured gateways)
- **Result display** with green/red styling based on success/failure
- Shows connection mode (sandbox vs production) in details

### Authorize.net Sandbox vs Production

**Critical Lesson**: Authorize.net sandbox and production are completely separate accounts:
- **Sandbox**: `sandbox.authorize.net` - Create test account here
- **Production**: `new.authorize.net` - Live account
- API Login ID and Transaction Key from one don't work on the other!

The test endpoint automatically selects the correct API endpoint based on `sandbox_mode`:
```typescript
const endpoint = config.sandbox_mode
  ? "https://apitest.authorize.net/xml/v1/request.api"
  : "https://api.authorize.net/xml/v1/request.api"
```

---

## Drinkyum Tenant Configuration (Jan 2, 2026)

### Tenant Setup
- **Tenant slug**: `yum` (not `drinkyum`)
- **Domain**: `drinkyum.com`
- **API domain**: `api.drinkyum.com` (CNAME to Railway backend)
- **Payment**: Authorize.net only (production mode)

### Frontend Environment (`.env.local`)

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.drinkyum.com
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_8a1c2236a1e5297ad86f28ca8b004fb08a04aa8d80c73ee2e529b970c64ff6cd
NEXT_PUBLIC_TENANT_SLUG=yum
S3_FILE_URL=https://medusa-multistore-assets.s3.us-east-1.amazonaws.com
```

### DNS Configuration

| Subdomain | Record Type | Value |
|-----------|-------------|-------|
| `api.drinkyum.com` | CNAME | Railway backend URL |
| `admin.drinkyum.com` | CNAME | Railway backend URL |

### Remaining Setup Tasks
1. ✅ Payment gateway configured (Authorize.net production)
2. ✅ Email configuration (AWS SES via admin UI)
3. ⏳ Add products in Medusa admin
4. ⏳ Configure shipping (last)

---

## Email Settings Admin UI (Jan 2, 2026)

### Overview
Created a new admin UI page under Settings → Email that allows tenant owners to configure email sending without API calls or SQL.

### Components Created

**Admin Page: `/src/admin/routes/settings/email/page.tsx`**
- Provider dropdown (AWS SES, SendGrid, Resend)
- Sender email and name inputs
- AWS SES region selector (only shown for SES)
- Test email functionality
- Permission-gated (super admin or tenant owner/admin only)

**Test Email API: `/src/api/admin/tenants/[slug]/email/test/route.ts`**
- `POST /admin/tenants/:slug/email/test`
- Sends a formatted HTML test email using the configured provider
- Returns success/failure with message ID

### Email Provider Configuration

Providers are configured per-tenant in `email_config` JSONB column:

```json
{
  "provider": "ses",
  "sender_email": "orders@drinkyum.com",
  "sender_name": "DrinkYUM",
  "ses_region": "us-east-1",
  "status": "verified"
}
```

### Provider Credentials

All three providers use **global environment variables** (not per-tenant credentials):

| Provider | Environment Variable(s) |
|----------|------------------------|
| **AWS SES** | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_REGION` |
| **SendGrid** | `SENDGRID_API_KEY` |
| **Resend** | `RESEND_API_KEY` |

The per-tenant config only stores sender details and provider selection.

### Implementation Details

**Medusa Settings Sidebar Integration:**
Pages at `src/admin/routes/settings/*/page.tsx` automatically appear in the Settings sidebar when they export:
```typescript
export const config = defineRouteConfig({
  label: "Email",  // Appears in sidebar
})
```

**Tenant Context:**
Uses `getCurrentTenantSlug()` from `src/admin/lib/tenant-switch.ts` to get the current tenant from cookie.

**Access Control:**
- Super admins can configure email for any tenant
- Tenant owners/admins can configure for their own tenant
- Checks `useUserRole()` and `useCurrentTenantRole()` hooks

### AWS SES Setup for DrinkYUM

1. **Global AWS credentials** already configured in Railway
2. **Verify sender email** in AWS SES console:
   - Go to SES → Verified identities → Create identity
   - Add `orders@drinkyum.com`
   - Click verification link in email
3. **Request production access** if still in sandbox mode
4. **Configure in admin UI**:
   - Provider: AWS SES
   - Region: us-east-1
   - Sender Email: orders@drinkyum.com
   - Sender Name: DrinkYUM
5. **Test email** using the admin UI test feature

---

## Bulk Product Editor (Jan 2, 2026)

### Overview
Ported the Handsontable-based Bulk Product Editor from the single-tenant project to the multi-tenant setup. Provides a spreadsheet interface for editing multiple products at once.

### Components Created

**Admin Page: `/src/admin/routes/bulk-editor/page.tsx`**
- Full Handsontable spreadsheet integration
- Edit multiple products in a familiar spreadsheet UI
- Columns: Thumbnail, Title, Handle, Status, Price, SKU, Collection, Images, ID
- Multi-tenant aware via cookie-based tenant context

### Features

| Feature | Description |
|---------|-------------|
| **Spreadsheet View** | Edit products in a familiar Excel-like grid |
| **New Product Row** | Green-highlighted "+" row at bottom for adding new products |
| **Image Manager** | Click thumbnail/images cells to open full image modal |
| **Drag & Drop Upload** | Drag images directly onto upload zone |
| **Media Library** | Browse and select from previously uploaded images |
| **Works with New Products** | Add images before saving new product |
| **CSV Export** | Export current view to CSV file |
| **Batch Save** | Save all changes at once |
| **Dark Mode** | Full dark mode support matching Medusa admin |

### Image Manager Modal

The image manager modal supports:

1. **Upload via file picker** - Click "Select Files" to browse
2. **Drag & drop** - Drop images directly on the upload zone
3. **Media library** - Toggle "Media Library" to browse all uploaded images
4. **Set thumbnail** - Click "Set as Thumbnail" on any image
5. **Delete images** - Red X button on image cards
6. **New product support** - Modal works for both existing and new (unsaved) products

### New Product Workflow

1. Click on the green "+" row at the bottom
2. Fill in at least the **Title** field
3. Click on **Thumbnail** or **Images** cell to open image manager
4. Upload or select images (stored temporarily)
5. Click **Save Changes** to create product with images

### Multi-Tenant Integration

The bulk editor automatically uses tenant context from the `x-tenant-id` cookie:
- All API calls use `credentials: "include"` to pass cookies
- Products shown/created are for the currently selected tenant
- No hardcoded tenant IDs; works with store switcher seamlessly

### Dependencies Added

```json
{
  "handsontable": "^15.0.0",
  "@handsontable/react": "^15.0.0"
}
```

### Key Files

| File | Purpose |
|------|---------|
| `src/admin/routes/bulk-editor/page.tsx` | Main bulk editor component |

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/products` | GET | Fetch products for spreadsheet |
| `/admin/products` | POST | Create new product |
| `/admin/products/:id` | POST | Update existing product |
| `/admin/products/:id/variants/:id` | POST | Update variant price |
| `/admin/collections` | GET | Fetch collections for dropdown |
| `/admin/product-categories` | GET | Fetch categories |
| `/admin/uploads` | POST | Upload images |
| `/admin/uploads` | GET | Fetch media library

---

## Publishable API Key Tenant Isolation (Jan 2-3, 2026)

### Problem
The Drinkyum frontend was getting "A valid publishable key is required to proceed with the request" errors when calling the Medusa store API.

### Root Cause
Medusa's `ensurePublishableApiKeyMiddleware` runs BEFORE custom middlewares in the Express middleware chain. The middleware uses `query.graph()` to look up the API key, but without tenant context set, it queries the `public` schema where tenant-specific keys don't exist.

**The timing issue:**
1. Medusa's built-in middlewares (CORS → publishable key → auth) are registered via `app.use()` in the framework's `router.js`
2. Custom middlewares from `middlewares.ts` are registered AFTER built-in middlewares
3. By the time our tenant middleware runs, publishable key validation has already failed

### Solution
Patched `ensurePublishableApiKeyMiddleware` in `instrumentation.ts` to resolve tenant context BEFORE validating the API key:

1. **Require hook patching**: Intercepts `require()` calls to patch the middleware module when it's loaded
2. **Cache patching**: Also patches the module if already in require cache
3. **Tenant resolution**: Reads `x-tenant-id` header and resolves tenant from database
4. **Search path setting**: Sets PostgreSQL search_path on the scoped Knex connection before the original middleware runs

```typescript
// instrumentation.ts - key changes
function createTenantAwareMiddleware(originalMiddleware: any) {
  return async function(req: any, res: any, next: any) {
    const tenantSlug = req.headers?.['x-tenant-id']

    if (!tenantSlug) {
      return originalMiddleware(req, res, next)  // Use public schema
    }

    // Resolve tenant from database
    const tenant = await resolveTenantBySlugDirect(tenantSlug)

    // Set search_path BEFORE validating API key
    const pgConnection = req.scope?.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await pgConnection.raw(`SET search_path TO "${tenant.schemaName}", public`)

    // Run original middleware within tenant context
    return runWithTenant(tenant, () => originalMiddleware(req, res, next))
  }
}
```

### Key Files Modified

| File | Changes |
|------|---------|
| `src/instrumentation.ts` | Added middleware patching, enhanced debug logging |
| `src/api/admin/tenants/route.ts` | Removed `api_key` from EXCLUDED_TABLES (keys are now tenant-specific) |

### Verification
```bash
# Test API key validation with tenant header
curl -X GET 'https://admin.radicalz.io/store/products' \
  -H 'x-publishable-api-key: pk_8a1c...' \
  -H 'x-tenant-id: yum'

# Returns: {"products":[],"count":0,"offset":0,"limit":50}
```

Logs show successful tenant resolution:
```
[tenant-instrumentation] Resolved tenant: yum -> schema tenant_yum
[tenant-instrumentation] Set search_path to tenant_yum on scoped connection
```

### Important: API Keys Are Now Tenant-Specific
Unlike the initial workaround that put API keys in the public schema, this fix keeps API keys in tenant schemas. Each tenant has their own publishable API keys that don't leak between tenants.

**Secret API keys already worked** because they're validated via `apiKeyModule.authenticate()` which runs AFTER custom middlewares when tenant context is set.

---

## Drinkyum Account & Auth Pages (Jan 2, 2026)

### Overview
Built a complete set of 16 account and authentication pages for the Drinkyum storefront following the existing dark theme design system with yum-pink (#E1258F) accent color.

### Pages Created

**Authentication Pages (4):**
| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Email/password form with password toggle, error handling, return URL support |
| Register | `/register` | Registration with password validation (8+ chars, number, uppercase), terms acceptance |
| Forgot Password | `/forgot-password` | Password reset request form with success confirmation |
| Reset Password | `/reset-password?token=xxx` | Token-based password reset with validation |

**Account Pages (11):**
| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/account` | Summary cards (orders, subscriptions, total spent), recent orders preview |
| Profile | `/account/profile` | Edit first/last name, phone (email read-only) |
| Change Password | `/account/password` | Current/new password form with validation |
| Orders List | `/account/orders` | Paginated order history with search and status badges |
| Order Detail | `/account/orders/[id]` | Full order info, items, shipping, tracking, return button |
| Addresses | `/account/addresses` | Address cards with add/edit modal, default shipping/billing badges |
| Subscriptions List | `/account/subscriptions` | S&S subscription cards with status, frequency, discount |
| Subscription Detail | `/account/subscriptions/[id]` | Manage subscription: pause, resume, skip, cancel, change frequency |
| Returns | `/account/returns` | Return request history with status tracking |

**Other Pages (2):**
| Page | Route | Description |
|------|-------|-------------|
| Order Confirmation | `/order/[id]/confirmed` | Post-purchase success page with order summary |
| Verify Email | `/verify-email?token=xxx` | Email verification handler with resend option |
| Search | `/search` | Product search with grid results and add-to-cart |

### Shared Components Created

| Component | File | Purpose |
|-----------|------|---------|
| AccountLayout | `src/components/account/AccountLayout.tsx` | Wrapper with auth protection, page title, sidebar integration |
| AccountSidebar | `src/components/account/AccountSidebar.tsx` | Desktop sidebar + mobile horizontal tabs navigation |

### Design System Applied

All pages follow the existing Drinkyum design patterns:
- Dark theme with `bg-yum-dark` (#080808)
- Primary accent `yum-pink` (#E1258F)
- Secondary accent `yum-cyan` (#00B8E4)
- Glassmorphism containers: `rgba(255,255,255,0.03)` with `rgba(255,255,255,0.08)` border
- Framer Motion animations (fade, slide, scale)
- Form inputs: `rounded-xl bg-white/5 border-white/10 focus:border-yum-pink`
- Button gradient: `linear-gradient(135deg, #E1258F 0%, #C01F7A 100%)`

### API Integration

All pages use the existing API layer in `src/lib/`:
- `auth.ts` - login, register, password reset, verify email
- `orders.ts` - order history, order details, returns
- `addresses.ts` - address CRUD with US states dropdown
- `subscriptions.ts` - S&S subscription management
- `products.ts` - product search

### Auth Protection Pattern

```typescript
// Used in AccountLayout.tsx
const { isAuthenticated, isLoading } = useAuth()
const router = useRouter()
const pathname = usePathname()

useEffect(() => {
  if (!isLoading && !isAuthenticated) {
    router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`)
  }
}, [isAuthenticated, isLoading, router, pathname])
```

### Key Files

| File | Purpose |
|------|---------|
| `src/app/login/page.tsx` | Login page |
| `src/app/register/page.tsx` | Register page |
| `src/app/forgot-password/page.tsx` | Password reset request |
| `src/app/reset-password/page.tsx` | Password reset with token |
| `src/app/verify-email/page.tsx` | Email verification |
| `src/app/account/page.tsx` | Account dashboard |
| `src/app/account/profile/page.tsx` | Profile settings |
| `src/app/account/password/page.tsx` | Change password |
| `src/app/account/orders/page.tsx` | Orders list |
| `src/app/account/orders/[id]/page.tsx` | Order detail |
| `src/app/account/addresses/page.tsx` | Address management |
| `src/app/account/subscriptions/page.tsx` | Subscriptions list |
| `src/app/account/subscriptions/[id]/page.tsx` | Subscription detail |
| `src/app/account/returns/page.tsx` | Returns list |
| `src/app/order/[id]/confirmed/page.tsx` | Order confirmation |
| `src/app/search/page.tsx` | Product search |
| `src/components/account/AccountLayout.tsx` | Account layout wrapper |
| `src/components/account/AccountSidebar.tsx` | Navigation component |
