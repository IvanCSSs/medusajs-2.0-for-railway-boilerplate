1# Multi-Tenant MedusaJS 2.0 on Railway

## Goal

Transform this MedusaJS boilerplate into a cost-effective, multi-tenant backend where multiple independent stores share ONE PostgreSQL, ONE Redis, and ONE Medusa instance.

## Architecture

```
                    ┌─────────────────────────────────┐
                    │        Custom Domains           │
                    │  store-a.com    store-b.com     │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
                    │       Railway (single project)  │
                    │  ┌───────────────────────────┐  │
                    │  │     Medusa Backend        │  │
                    │  │  (tenant middleware)      │  │
                    │  └─────────────┬─────────────┘  │
                    │                │                │
                    │  ┌─────────────▼─────────────┐  │
                    │  │       PostgreSQL          │  │
                    │  │  ┌─────┐ ┌─────┐ ┌─────┐  │  │
                    │  │  │store│ │store│ │store│  │  │
                    │  │  │ _a  │ │ _b  │ │ _c  │  │  │
                    │  │  └─────┘ └─────┘ └─────┘  │  │
                    │  └───────────────────────────┘  │
                    │  ┌───────────────────────────┐  │
                    │  │     Redis (namespaced)    │  │
                    │  └───────────────────────────┘  │
                    └─────────────────────────────────┘
```

**Cost: ~$5-15/month total** (not per store)

---

## How It Works

1. **Request comes in** → `store-a.com/products`
2. **Middleware resolves tenant** → domain maps to `store_a` schema
3. **Schema is set** → `SET search_path TO store_a`
4. **Medusa processes request** → all queries hit `store_a.*` tables
5. **Response returns** → completely isolated data

---

## What Needs to Change

### Remove (Not Needed)

| Item | Reason |
|------|--------|
| `/storefront` | Backend-only setup |
| MeiliSearch config | Optional, add later if needed |
| MinIO config | Use S3/R2 directly if needed |

### Keep

| Item | Purpose |
|------|---------|
| `/backend` | Core Medusa API |
| PostgreSQL | Data storage (with schemas) |
| Redis | Caching (with key prefixes) |

---

## Components to Build

### 1. Tenant Registry Table

```sql
-- In public schema (shared)
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    schema_name VARCHAR(63) UNIQUE NOT NULL,
    domains TEXT[] NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Tenant Resolution Middleware

**File:** `backend/src/api/middlewares.ts`

```typescript
import { defineMiddlewares } from "@medusajs/medusa"
import { AsyncLocalStorage } from "async_hooks"

export const tenantContext = new AsyncLocalStorage<{ schema: string }>()

// Domain → Schema mapping (loaded from DB or config)
const domainToSchema: Record<string, string> = {
  "store-a.com": "store_a",
  "store-b.com": "store_b",
  "localhost:9000": "store_dev",
}

export default defineMiddlewares({
  routes: [{
    matcher: "*",
    middlewares: [
      async (req, res, next) => {
        const host = req.headers.host
        const schema = domainToSchema[host]

        if (!schema) {
          return res.status(400).json({ error: "Unknown store" })
        }

        tenantContext.run({ schema }, () => {
          req.tenantSchema = schema
          next()
        })
      }
    ]
  }]
})
```

### 3. Database Schema Switching

**File:** `backend/src/modules/tenant-db/index.ts`

Hook into database connections to set `search_path` per request:

```typescript
import { tenantContext } from "../../api/middlewares"

// On each query, set the schema
const ctx = tenantContext.getStore()
if (ctx?.schema) {
  await connection.raw(`SET search_path TO ${ctx.schema}, public`)
}
```

### 4. Redis Key Namespacing

**File:** `backend/src/modules/tenant-redis/index.ts`

```typescript
// Instead of: cache:products
// Use: tenant:store_a:cache:products
const prefix = `tenant:${ctx.schema}:`
```

---

## Store Management Scripts

### Create Store

```bash
./scripts/create-store.ts "My Store" store_mystore mystore.com
```

What it does:
- Creates PostgreSQL schema
- Runs Medusa migrations
- Seeds default data (region, currency)
- Registers in `public.tenants`
- Creates admin user

### Delete Store

```bash
./scripts/delete-store.ts store_mystore --force
```

What it does:
- Drops PostgreSQL schema
- Removes from tenant registry
- Clears Redis keys

### List Stores

```bash
./scripts/list-stores.ts
```

### Migrate All

```bash
./scripts/migrate-all.ts
```

---

## Domain Management

Each store can have:
- **Railway domain:** `your-app.up.railway.app` (shared, routed by Host header)
- **Custom domain:** `api.mystore.com`

To add a custom domain:
1. Add domain in Railway project settings
2. Configure DNS CNAME
3. Update `domains` array in `public.tenants`

---

## Target File Structure

```
medusa-multistore/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   └── middlewares.ts        # Tenant resolution
│   │   ├── modules/
│   │   │   ├── tenant-db/            # Schema switching
│   │   │   └── tenant-redis/         # Key namespacing
│   │   └── types/
│   │       └── tenant.ts
│   ├── medusa-config.ts
│   └── package.json
├── scripts/
│   ├── create-store.ts
│   ├── delete-store.ts
│   ├── list-stores.ts
│   └── migrate-all.ts
├── railway.json
└── ARCHITECTURE.md                   # This file
```

---

## Implementation Checklist

### Phase 1: Strip Down

- [x] Remove `/storefront` directory
- [x] Remove MeiliSearch from Railway config
- [x] Remove MinIO from Railway config
- [x] Clean up unused env vars

### Phase 2: Tenant Infrastructure

- [x] Create tenant registry table
- [x] Build tenant middleware
- [x] Implement schema switching module
- [x] Implement Redis namespacing

### Phase 3: Store Management

- [x] Build `create-store.ts` script (via API endpoint)
- [x] Build `delete-store.ts` script (via API endpoint)
- [x] Build `list-stores.ts` script (via API endpoint)
- [x] Build `migrate-all.ts` script (tables copied at creation)

### Phase 4: Testing

- [x] Test with 2 stores locally
- [x] Test domain routing
- [x] Test data isolation

### Phase 5: Deploy

- [x] Deploy to Railway
- [x] Configure custom domains (admin.radicalz.io)
- [x] Verify production setup

---

## Known Challenges

| Challenge | Solution |
|-----------|----------|
| MikroORM caches schema | Fork EntityManager per request |
| Background jobs lack context | Store `tenantSchema` in job payload |
| Admin panel routing | Each domain's `/admin` routes to its schema |
| Cross-tenant queries | Use `public` schema or explicit schema prefix |
| **Auth tables in tenant schemas** | **CRITICAL: Exclude from copy (see below)** |

### Tables That Must ONLY Exist in Public Schema

When creating tenant schemas, these tables must NOT be copied:
- `user` - Authentication users
- `auth_identity` - Auth identity records
- `provider_identity` - Password hashes and auth providers
- `invite` - User invitations
- `user_tenant_assignments` - Multi-tenant access control

**Why:** PostgreSQL `search_path` checks tenant schema first. If empty copies of these tables exist in tenant schemas, Medusa's auth middleware finds them (empty) instead of the actual data in public schema, causing:
- Random logouts
- "Invalid email or password" errors
- 401 Unauthorized on random routes

---

## Railway Services (Final)

| Service | Purpose |
|---------|---------|
| **medusa-backend** | Main API (multi-tenant) |
| **postgres** | Shared DB with schemas |
| **redis** | Shared cache with prefixes |

**Three services, unlimited stores.**

---

## File Storage Architecture (S3 with Tenant Isolation)

### Overview

Product images and files are stored in AWS S3 with tenant-prefixed paths for isolation:

```
s3://medusa-multistore-assets/
├── attack-dog/
│   ├── products/
│   │   ├── abc123.jpg
│   │   └── def456.png
│   └── files/
│       └── document.pdf
├── ivan-pleeh/
│   └── products/
│       └── shoe.webp
└── public/
    └── files/
        └── shared-asset.png
```

### URL Strategy (SEO-Friendly)

Images are stored with **relative URLs** for frontend flexibility:

| What Medusa Stores | What Customer Sees |
|-------------------|-------------------|
| `/cdn/products/abc123.jpg` | `https://attackdog.com/cdn/products/abc123.jpg` |

The frontend (Vercel) rewrites `/cdn/*` to the actual S3 URL:

```javascript
// next.config.js (per-tenant)
async rewrites() {
  return [{
    source: '/cdn/:path*',
    destination: 'https://medusa-multistore-assets.s3.us-east-1.amazonaws.com/attack-dog/:path*',
  }]
}
```

**Benefits:**
- SEO: Images appear on tenant's domain for backlink authority
- Flexibility: Frontend controls the CDN/proxy layer
- Simplicity: Single S3 bucket with tenant prefixes

### S3 Configuration

| Setting | Value |
|---------|-------|
| **Bucket** | `medusa-multistore-assets` |
| **Region** | `us-east-1` |
| **Public Access** | Enabled (for image serving) |
| **CORS** | Enabled for all origins |
| **IAM User** | `medusa-multistore-s3` (scoped permissions) |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/files/upload` | POST | Upload file with tenant prefix (multipart/form-data) |
| `/admin/files/presign` | POST | Get presigned URL for direct browser upload |

### Environment Variables

```
S3_BUCKET=medusa-multistore-assets
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
S3_FILE_URL=https://medusa-multistore-assets.s3.us-east-1.amazonaws.com
```

### Key Files

| File | Purpose |
|------|---------|
| `src/modules/tenant-file/service.ts` | Tenant-aware S3 upload service |
| `src/api/admin/files/upload/route.ts` | File upload endpoint |
| `src/api/admin/files/presign/route.ts` | Presigned URL endpoint |
| `medusa-config.ts` | S3 module configuration |

---

## Custom Admin Domain (Shopify-Style)

### Overview

Following Shopify's architecture, the admin panel is served from a unified domain for all tenants:

| Component | Domain | Purpose |
|-----------|--------|---------|
| **Admin Panel** | `admin.radicalz.io` | Shared admin for all merchants |
| **Storefront** | `{custom-domain}.com` | Per-tenant, customer-facing (Vercel) |
| **Store API** | `admin.radicalz.io/store/*` | API with tenant header |

### DNS Configuration

| Type | Name | Value |
|------|------|-------|
| CNAME | admin | `4gja94zd.up.railway.app` |

### Railway Environment Variables

```
ADMIN_CORS=http://localhost:5173,http://localhost:9000,https://docs.medusajs.com,https://admin.radicalz.io
AUTH_CORS=http://localhost:5173,http://localhost:9000,https://docs.medusajs.com,https://admin.radicalz.io
MEDUSA_BACKEND_URL=https://admin.radicalz.io
```

### Medusa Configuration

```typescript
// medusa-config.ts
admin: {
  backendUrl: "https://admin.radicalz.io",
  disable: process.env.DISABLE_ADMIN === "true",
},
```

### Dockerfile Fix for Admin Serving

Medusa's `serve` function looks for admin at `{rootDirectory}/public/admin/`, but `medusa build` outputs to `.medusa/server/public/admin/`. The Dockerfile must copy the admin to the correct location:

```dockerfile
# Build the application
RUN npm run build 2>&1 && echo "Build complete"

# Copy admin from .medusa/server/public/admin to ./public/admin
# Medusa start looks for admin at {rootDirectory}/public/admin
RUN mkdir -p /app/public && \
    cp -r /app/.medusa/server/public/admin /app/public/admin
```

### Key Files

| File | Purpose |
|------|---------|
| `medusa-config.ts` | `backendUrl` and `disable` settings |
| `Dockerfile` | Admin copy step for production |

---

# Admin Customization Guide

## Overview

Medusa 2.0 admin customization works through these mechanisms:

| Method | Purpose | Rebuild Required? |
|--------|---------|-------------------|
| **Widgets** | Inject content into existing pages | Yes |
| **UI Routes** | Create entirely new pages | Yes |
| **API Routes** | Backend endpoints for custom data | No (restart only) |
| **Environment Variables** | Runtime configuration | No |

---

## Limitations (Without Forking)

You **cannot** modify:
- Existing page layouts (product list, order details)
- Built-in form fields (add product, create user)
- The Medusa logo/branding
- Hot-reload admin changes (always need rebuild)

---

## Widget Injection Zones

Widgets inject into predetermined zones on existing pages:

```
product.details.before     product.details.after
product.list.before        product.list.after

order.details.before       order.details.after
order.list.before          order.list.after

customer.details.before    customer.details.after
customer.list.before       customer.list.after

inventory.details.before   inventory.details.after
```

**Example Widget:**
```tsx
// backend/src/admin/widgets/product-brand.tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading } from "@medusajs/ui"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"

const ProductBrandWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Brand: {data.metadata?.brand || "N/A"}</Heading>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductBrandWidget
```

---

## UI Routes (Custom Pages)

Create new pages that appear in the admin sidebar:

```tsx
// backend/src/admin/routes/my-dashboard/page.tsx
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import { Container, Heading } from "@medusajs/ui"

const MyDashboardPage = () => {
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h1">Custom Dashboard</Heading>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "My Dashboard",   // Sidebar label
  icon: ChartBar,          // Sidebar icon
})

export default MyDashboardPage
```

**Dynamic Routes:**
```
backend/src/admin/routes/
├── email-templates/
│   ├── page.tsx              # List: /app/email-templates
│   └── [id]/
│       └── page.tsx          # Detail: /app/email-templates/:id
```

---

## Custom API Routes

Backend endpoints that your admin UI calls:

```typescript
// backend/src/api/admin/my-feature/route.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Fetch data
  const data = await fetchMyData()
  return res.json({ data })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Create data
  const created = await createMyData(req.body)
  return res.status(201).json({ data: created })
}
```

**Important:** API route changes do NOT require rebuild - just restart the server.

---

## Configuration Files

| File | Purpose | Rebuild? |
|------|---------|----------|
| `medusa-config.js` | Core app config (modules, plugins, admin) | Yes |
| `.env` | Environment variables | No |
| `src/admin/widgets/*.tsx` | Widget components | Yes |
| `src/admin/routes/**/*.tsx` | Custom pages | Yes |
| `src/api/**/*.ts` | API routes | No |

---

## Avoiding "Needs Rebuild" Issues

**When you MUST rebuild:**
- Adding/changing widgets in `src/admin/widgets/`
- Adding/changing UI routes in `src/admin/routes/`
- Modifying `medusa-config.js`
- Updating Medusa dependencies

**When restart is enough:**
- Changing `.env` values
- Modifying API routes in `src/api/`
- Database changes

**Proper Workflow:**
```bash
# After admin code changes (widgets, routes, config):
npm run build && npm run dev

# After API-only changes:
# Just restart the server (Ctrl+C, npm run dev)
```

---

## Environment Variables for Admin

Must be prefixed with `MEDUSA_ADMIN_` to be available in admin dashboard:

```env
# Admin credentials
MEDUSA_ADMIN_EMAIL=admin@example.com
MEDUSA_ADMIN_PASSWORD=supersecret

# Admin behavior
MEDUSA_DISABLE_ADMIN=false
MEDUSA_WORKER_MODE=shared

# Custom admin variables (accessible in admin code)
MEDUSA_ADMIN_CUSTOM_FEATURE_FLAG=true
```

---

## Existing Customizations in This Boilerplate

The repo already includes these admin extensions as examples:

| Feature | Location | Type |
|---------|----------|------|
| Abandoned Carts | `src/admin/routes/abandoned-carts/` | UI Route |
| Email Templates | `src/admin/routes/email-templates/` | UI Route |
| RBAC (Roles) | `src/admin/routes/rbac/` | UI Route |
| Customer Timeline | `src/admin/widgets/customer-timeline.tsx` | Widget |

These serve as working examples for building additional customizations.

---

## Adding Custom Fields to Products (Workaround)

Since you can't modify built-in forms, use this pattern:

1. **Create a widget** that shows after product details
2. **Store data in `metadata`** (products have a JSONB metadata field)
3. **Create an API route** to update the metadata

```tsx
// Widget that edits product metadata
const ProductCustomFields = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const [brand, setBrand] = useState(data.metadata?.brand || "")

  const save = async () => {
    await fetch(`/admin/products/${data.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        metadata: { ...data.metadata, brand }
      }),
    })
  }

  return (
    <Container>
      <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
      <Button onClick={save}>Save Brand</Button>
    </Container>
  )
}
```

---

## File Structure for Admin Customizations

```
backend/src/
├── admin/
│   ├── widgets/
│   │   ├── customer-timeline.tsx      # Existing
│   │   ├── product-custom-fields.tsx  # Example
│   │   └── order-notes.tsx            # Example
│   ├── routes/
│   │   ├── abandoned-carts/           # Existing
│   │   │   └── page.tsx
│   │   ├── email-templates/           # Existing
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── rbac/                      # Existing
│   │   │   └── ...
│   │   └── my-feature/                # Your new feature
│   │       └── page.tsx
│   └── tsconfig.json
├── api/
│   └── admin/
│       ├── abandoned-carts/route.ts   # Existing
│       ├── email-templates/route.ts   # Existing
│       └── my-feature/route.ts        # Your new API
└── modules/
    └── ...                            # Custom Medusa modules
```

---

# Super Admin & Advanced Features

## Our Model vs. Marketplace Model

| Aspect | Igor's Marketplace | Our Private SaaS |
|--------|-------------------|------------------|
| **Who creates stores** | Vendors self-register | You (platform owner) create stores |
| **Admin access** | Vendors manage own stores | You manage all client stores |
| **Data isolation** | Vendor sees only their data | Schema-per-tenant (complete isolation) |
| **Use case** | Etsy-like marketplace | Private Shopify-like platform |

---

## Super Admin Implementation

### Concept

A **Super Admin** (you, the platform owner) has full access to:
- All tenant stores
- Cross-tenant reporting
- Tenant management (create/delete/suspend)
- Impersonate any tenant for support

### User Roles

```
┌─────────────────────────────────────────────────────────┐
│                    SUPER ADMIN (You)                    │
│  - Can switch between any tenant                        │
│  - Access to /admin/stores management                   │
│  - Can impersonate tenant admins                        │
│  - Cross-tenant analytics (future)                      │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  Tenant A   │ │  Tenant B   │ │  Tenant C   │
    │  Admin(s)   │ │  Admin(s)   │ │  Admin(s)   │
    │  (isolated) │ │  (isolated) │ │  (isolated) │
    └─────────────┘ └─────────────┘ └─────────────┘
```

### Implementation Pattern

**1. Super Admin Identification**

Store `is_super_admin: true` in user metadata:

```typescript
// When creating super admin
const user = await userService.createUsers({
  email: "admin@yourcompany.com",
  password: "...",
  metadata: { is_super_admin: true }
});
```

**2. Super Admin Middleware Check**

```typescript
// src/api/middlewares/only-for-super-admin.ts
export async function onlyForSuperAdmins(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const loggedInUser = req.scope.resolve("loggedInUser", {
    allowUnregistered: true,
  }) as UserDTO;

  if (!loggedInUser?.metadata?.is_super_admin) {
    return res.status(403).json({ error: "Super Admin access required" });
  }

  next();
}
```

**3. Apply to Protected Routes**

```typescript
// src/api/middlewares.ts
{
  matcher: "/admin/stores",
  middlewares: [onlyForSuperAdmins],
},
{
  matcher: "/tenants",
  middlewares: [onlyForSuperAdmins],
},
```

---

## Tenant Impersonation (For Support)

### Use Case

As Super Admin, you need to troubleshoot a client's store without knowing their password.

### Implementation

**1. Impersonate API Route**

```typescript
// src/api/admin/impersonate/route.ts
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { tenantSlug } = req.body;

  // Store impersonation in session
  req.session.impersonate_tenant = tenantSlug;

  res.json({
    message: `Now impersonating tenant: ${tenantSlug}`,
    tenant: tenantSlug
  });
};
```

**2. Reset Impersonation**

```typescript
// src/api/admin/impersonate-reset/route.ts
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  delete req.session.impersonate_tenant;
  res.json({ message: "Impersonation ended" });
};
```

**3. UI Indicator (Impersonation Bar)**

When impersonating, show a banner in the admin:

```tsx
// In admin layout or widget
const ImpersonationBar = () => {
  const tenant = localStorage.getItem("currentTenantSlug");

  if (!tenant) return null;

  return (
    <div className="bg-purple-600 text-white px-4 py-2 flex justify-between">
      <span>Working as: {tenant}</span>
      <button onClick={resetImpersonation}>Exit</button>
    </div>
  );
};
```

---

## Dashboard Customization Strategies

### Method 1: Widgets & Routes (Recommended)

Use Medusa's built-in extension points:

| Feature | Implementation |
|---------|----------------|
| Store Switcher | Widget in `order.list.before` zone |
| Stores Page | Custom route `/app/stores` |
| Tenant Info | Widget showing current tenant context |

### Method 2: Patch Script (Advanced)

For deeper customizations, use a post-install patch script:

```javascript
// patch-admin.js
const fs = require("fs");

// Find and modify compiled dashboard files
const APP_MJS = "node_modules/@medusajs/dashboard/dist/app.mjs";

let content = fs.readFileSync(APP_MJS, "utf8");

// Example: Replace "Welcome to Medusa" with custom branding
content = content.replace(
  /Welcome to Medusa/g,
  "Welcome to Your Platform"
);

fs.writeFileSync(APP_MJS, content);

// Clear Vite cache
const VITE_CACHE = "node_modules/@medusajs/admin-bundler/node_modules/.vite";
if (fs.existsSync(VITE_CACHE)) {
  fs.rmSync(VITE_CACHE, { recursive: true });
}
```

Add to package.json:
```json
{
  "scripts": {
    "postinstall": "node patch-admin.js"
  }
}
```

---

## Implemented Role System

### User Roles & Permissions

The multi-tenant system now has a complete role-based access control system:

```
┌─────────────────────────────────────────────────────────────────┐
│                      SUPER ADMIN                                 │
│  metadata: { is_super_admin: true }                              │
│                                                                  │
│  Capabilities:                                                   │
│  - Switch between any tenant via store switcher                  │
│  - Access /admin/stores management page                          │
│  - Create, update, and delete tenants                           │
│  - Assign users to tenants                                       │
│  - View cross-tenant data                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Tenant Admin   │  │  Tenant Admin   │  │  Tenant Admin   │
│  Store A        │  │  Store B        │  │  Store C        │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ metadata: {     │  │ metadata: {     │  │ metadata: {     │
│   tenant_slug:  │  │   tenant_slug:  │  │   tenant_slug:  │
│   "store-a"     │  │   "store-b"     │  │   "store-c"     │
│ }               │  │ }               │  │ }               │
└─────────────────┘  └─────────────────┘  └─────────────────┘
     (isolated)           (isolated)           (isolated)
```

### API Endpoints

| Endpoint | Method | Description | Access |
|----------|--------|-------------|--------|
| `/admin/me/role` | GET | Get current user's role info | All authenticated |
| `/admin/tenants` | GET | List all tenants | Super Admin |
| `/admin/tenants` | POST | Create new tenant | Super Admin |
| `/admin/tenants/:slug` | GET | Get tenant details | Super Admin |
| `/admin/tenants/:slug` | PATCH | Update tenant | Super Admin |
| `/admin/tenants/:slug` | DELETE | Delete tenant | Super Admin |
| `/admin/tenants/:slug/users` | GET | List users in tenant | Super Admin |
| `/admin/tenants/:slug/users` | POST | Assign user to tenant | Super Admin |
| `/admin/tenants/:slug/users` | DELETE | Remove user from tenant | Super Admin |

### User Metadata Schema

```typescript
// Super Admin
{
  is_super_admin: true
}

// Tenant Admin
{
  tenant_slug: "acme-store"  // Assigned tenant
}

// Regular User (no special access)
{
  // No tenant_slug = can only access public schema
}
```

### Middleware Chain

For `/admin/*` routes:

1. **tenantMiddleware** - Resolves tenant from header/cookie/domain
2. **tenantDbMiddleware** - Sets PostgreSQL search_path
3. **[Medusa's built-in auth]** - Authenticates user
4. **tenantAdminContextMiddleware** - Enforces tenant for non-super-admins

### Admin UI Behavior

| User Type | Stores Page | Store Switcher Widget |
|-----------|-------------|----------------------|
| Super Admin | Full access (create/edit/delete) | Full dropdown with all stores |
| Tenant Admin | Access denied message | Read-only display of assigned store |
| No assignment | Access denied message | Hidden |

### Assigning Users to Tenants

**Via SQL:**
```sql
-- Make user a super admin
UPDATE public."user"
SET metadata = '{"is_super_admin": true}'::jsonb
WHERE email = 'admin@yourplatform.com';

-- Assign user to a tenant
UPDATE public."user"
SET metadata = '{"tenant_slug": "acme-store"}'::jsonb
WHERE email = 'admin@acme.com';
```

**Via API:**
```bash
# Assign user to tenant
curl -X POST /admin/tenants/acme-store/users \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_123"}'

# Remove user from tenant
curl -X DELETE /admin/tenants/acme-store/users \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_123"}'
```

### Key Implementation Files

| File | Purpose |
|------|---------|
| `src/api/admin/me/role/route.ts` | Get current user role info |
| `src/api/admin/tenants/route.ts` | Tenant list & creation |
| `src/api/admin/tenants/[slug]/route.ts` | Single tenant operations |
| `src/api/admin/tenants/[slug]/users/route.ts` | Tenant user management |
| `src/api/middlewares/tenant-admin-context.ts` | Enforce tenant for non-super-admins |
| `src/admin/lib/use-user-role.ts` | React hook for role info |
| `src/admin/routes/stores/page.tsx` | Stores management page (super admin) |
| `src/admin/widgets/store-switcher.tsx` | Store switcher widget |

---
I
## Future Enhancements

### Phase 6: Super Admin Features

- [x] Cross-tenant store switching
- [x] Tenant management UI (create/delete)
- [x] User-to-tenant assignment API
- [x] Role-based dashboard filtering
- [ ] Cross-tenant analytics dashboard
- [ ] Tenant health monitoring
- [ ] Bulk operations across tenants
- [ ] Audit logging for Super Admin actions

### Phase 7: Multi-Tenant Admin Support (Klaviyo-style)

Allow users to be assigned to multiple tenants with per-tenant roles.

#### Database Schema

```sql
-- New table: user_tenant_assignments
CREATE TABLE public.user_tenant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  tenant_slug VARCHAR(50) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',  -- 'owner', 'admin', 'editor', 'viewer'
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by TEXT REFERENCES public."user"(id),

  UNIQUE(user_id, tenant_slug)
);

-- Index for fast lookups
CREATE INDEX idx_user_tenant_user ON public.user_tenant_assignments(user_id);
CREATE INDEX idx_user_tenant_tenant ON public.user_tenant_assignments(tenant_slug);
```

#### Migration from Current System

```sql
-- Migrate existing tenant_slug from user.metadata to assignment table
INSERT INTO public.user_tenant_assignments (user_id, tenant_slug, role)
SELECT id, metadata->>'tenant_slug', 'admin'
FROM public."user"
WHERE metadata->>'tenant_slug' IS NOT NULL
  AND metadata->>'is_super_admin' IS NOT TRUE;
```

#### Updated Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      SUPER ADMIN                                 │
│  metadata: { is_super_admin: true }                              │
│  Access: ALL tenants, can create/delete tenants                  │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Multi-Tenant    │  │ Single-Tenant   │  │ Single-Tenant   │
│ Admin           │  │ Admin           │  │ Admin           │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ Assignments:    │  │ Assignments:    │  │ Assignments:    │
│ - store-a:admin │  │ - store-b:admin │  │ - store-c:admin │
│ - store-b:viewer│  │                 │  │                 │
│                 │  │                 │  │                 │
│ Can switch      │  │ Read-only       │  │ Read-only       │
│ between A & B   │  │ single store    │  │ single store    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

#### Per-Tenant Roles

| Role | Permissions |
|------|-------------|
| `owner` | Full access, can invite/remove users |
| `admin` | Full access to products, orders, settings |
| `editor` | Can edit products, manage orders |
| `viewer` | Read-only access |

#### API Changes

**Updated `/admin/me/role` response:**
```typescript
{
  "role": {
    "id": "user_123",
    "email": "user@example.com",
    "is_super_admin": false,
    "tenants": [
      { "slug": "attack-dog", "name": "Attack Dog", "role": "admin", "last_accessed": "2025-12-28T..." },
      { "slug": "ivan-pleeh", "name": "ivan pleeh", "role": "viewer", "last_accessed": "2025-12-27T..." }
    ],
    "current_tenant": "attack-dog"  // From cookie
  }
}
```

**New endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/me/tenants` | GET | List tenants user has access to |
| `/admin/me/tenants/:slug/switch` | POST | Switch to tenant, updates last_accessed |

#### Middleware Changes

**`tenantAdminContextMiddleware` updates:**
```typescript
// Current: Check single tenant_slug in metadata
const userTenantSlug = metadata.tenant_slug

// New: Query user_tenant_assignments table
const assignments = await getUserTenantAssignments(userId)
const allowedSlugs = assignments.map(a => a.tenant_slug)

// Validate cookie tenant is in allowed list
const requestedTenant = getCurrentTenantSlug(req)
if (!allowedSlugs.includes(requestedTenant)) {
  return res.status(403).json({ message: 'Access denied to this tenant' })
}

// Optionally check role for write operations
const assignment = assignments.find(a => a.tenant_slug === requestedTenant)
if (isWriteOperation(req) && assignment.role === 'viewer') {
  return res.status(403).json({ message: 'Read-only access' })
}
```

#### Store Switcher UI Changes

Three modes:
1. **Super Admin**: Dropdown with ALL tenants + create button
2. **Multi-Tenant Admin**: Dropdown with only their assigned tenants (no create)
3. **Single-Tenant Admin**: Read-only badge showing their one store

```tsx
// Multi-tenant admin view
if (role.tenants.length > 1) {
  return (
    <Select value={currentTenant} onChange={handleSwitch}>
      {role.tenants.map(t => (
        <Select.Item key={t.slug} value={t.slug}>
          {t.name} ({t.role})
        </Select.Item>
      ))}
    </Select>
  )
}
```

#### Implementation Checklist

- [x] Create `user_tenant_assignments` table
- [x] Migrate existing `tenant_slug` metadata to new table
- [x] Update `/admin/me/role` to return tenants array
- [x] Update `tenantAdminContextMiddleware` to query assignments
- [x] Add role-based permission checks for write operations
- [x] Update Store Switcher widget for multi-tenant admins
- [x] Add "last accessed" tracking on tenant switch
- [ ] Create invite flow for tenant owners
- [ ] Add audit logging for access changes

---

## User & Role Management System (Implemented)

### Overview

A complete user and role management system that provides:
1. **Super Admin Users Page** - Platform-wide user management
2. **Per-Tenant Team Panel** - Tenant-level team management

### Role Hierarchy

| Role | Level | Capabilities |
|------|-------|--------------|
| `owner` | 4 | Full access, manage team including other owners |
| `admin` | 3 | Most access, manage team except owners |
| `editor` | 2 | Edit products/orders, no settings/team |
| `viewer` | 1 | Read-only access |

### API Endpoints

#### Super Admin User Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/users` | GET | List all users (filter: ?tenant=&search=) |
| `/admin/users` | POST | Create user with optional tenant assignment |
| `/admin/users/:id` | GET | Get user with all assignments |
| `/admin/users/:id` | PATCH | Update user info, super admin flag |
| `/admin/users/:id` | DELETE | Delete user |
| `/admin/users/:id/assignments` | GET | List user's tenant assignments |
| `/admin/users/:id/assignments` | POST | Add user to tenant `{ tenant_slug, role }` |
| `/admin/users/:id/assignments/:tenant_slug` | PATCH | Change role `{ role }` |
| `/admin/users/:id/assignments/:tenant_slug` | DELETE | Remove from tenant |

#### Tenant Team Management (For Owners/Admins)

| Endpoint | Method | Description | Access |
|----------|--------|-------------|--------|
| `/admin/team` | GET | List current tenant's team | Owner/Admin |
| `/admin/team` | POST | Add user to team `{ user_id, role }` | Owner/Admin |
| `/admin/team/:user_id` | PATCH | Change role `{ role }` | Owner only |
| `/admin/team/:user_id` | DELETE | Remove from team | Owner/Admin |

### Admin UI Components

#### Users Page (Super Admin Only)
- Location: `/app/users`
- Features:
  - List all users with tenant assignments
  - Search by email, filter by tenant
  - Create new users with optional tenant assignment
  - Edit user details and super admin status
  - Manage tenant assignments

#### User Detail Page
- Location: `/app/users/:id`
- Features:
  - Edit first name, last name
  - Toggle super admin status
  - View all tenant assignments
  - Add/remove tenant assignments
  - Change roles per tenant

#### Team Panel Widget
- Location: `order.list.before` zone (visible on Orders page)
- Features:
  - List current tenant's team members
  - Add users to team (search by email)
  - Change member roles (owner only)
  - Remove members
  - Shows current user's role

### Permission Enforcement

| Action | Owner | Admin | Editor | Viewer |
|--------|-------|-------|--------|--------|
| View team | Yes | Yes | No | No |
| Add members | Yes | Yes | No | No |
| Remove members | Yes | Yes* | No | No |
| Change roles | Yes | No | No | No |
| Edit products | Yes | Yes | Yes | No |
| View only | Yes | Yes | Yes | Yes |

*Admin cannot remove owners

### Key Files

| File | Purpose |
|------|---------|
| `src/api/middlewares/rbac.ts` | Server-side RBAC utilities |
| `src/api/admin/users/route.ts` | User list & creation |
| `src/api/admin/users/[id]/route.ts` | Single user operations |
| `src/api/admin/users/[id]/assignments/route.ts` | User assignment management |
| `src/api/admin/team/route.ts` | Tenant team management |
| `src/api/admin/team/[user_id]/route.ts` | Single team member operations |
| `src/admin/lib/rbac.ts` | Client-side RBAC utilities |
| `src/admin/lib/use-user-role.ts` | React hooks for role info |
| `src/admin/routes/users/page.tsx` | Users list page |
| `src/admin/routes/users/[id]/page.tsx` | User detail page |
| `src/admin/widgets/team-panel.tsx` | Team management widget |

### React Hooks

```typescript
// Get current user's role info
const { role, loading, refetch } = useUserRole()

// Check if super admin
const isSuperAdmin = useIsSuperAdmin()

// Get current role in selected tenant
const currentRole = useCurrentTenantRole()

// Permission checks
const canManageTeam = useCanManageTeam()
const canChangeRoles = useCanChangeRoles()
```

### Phase 8: Email Notifications (Implemented)

- [x] Set up Resend notification provider
- [x] Configure invite email subscriber
- [x] Domain verification (ecombackend.radicalz.io)
- [x] HTML email templates for invites

### Phase 9: Security Hardening (Implemented)

- [x] Block non-super-admins from /admin/invites routes
- [x] Hide Settings → Team menu for non-super-admins
- [x] Super admin middleware protection

### Phase 10: Tenant Self-Service (Optional)

If you want clients to self-manage:
- [ ] Tenant settings page
- [ ] Domain management UI
- [ ] Usage/billing dashboard

### Phase 11: Plugin Architecture

Package multi-tenancy as a reusable plugin:

```
@yourcompany/medusa-multitenancy-plugin/
├── src/
│   ├── api/
│   │   ├── middlewares/
│   │   └── tenants/
│   ├── admin/
│   │   ├── routes/stores/
│   │   └── widgets/store-switcher.tsx
│   ├── lib/
│   │   ├── tenant-context.ts
│   │   └── tenant-resolver.ts
│   └── index.ts
├── package.json
└── README.md
```

Installation would be:
```bash
yarn add @yourcompany/medusa-multitenancy-plugin
```

---

---

# Subscription & Payment Gateway System

## Overview

The platform includes a comprehensive subscription and payment system with three major features:
1. **Subscribe & Save** - Per-product recurring purchases with frequency-based discounts
2. **Multi-Tenant Payment Gateway Configuration** - Shopify-style per-tenant gateway settings
3. **Gated Content Subscriptions** (planned) - Content access control based on subscription plans

All features are tenant-specific, supporting the schema-per-tenant isolation model.

---

## Subscribe & Save System

### Concept

Products can have "Subscribe & Save" enabled, allowing customers to purchase products on a recurring basis with automatic discounts based on frequency.

```
┌─────────────────────────────────────────────────────────────────┐
│                     TENANT DEFAULTS                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Subscribe & Save: ENABLED                                │    │
│  │ Weekly Discount:  5%                                     │    │
│  │ Monthly Discount: 10%                                    │    │
│  │ Yearly Discount:  15%                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │  Product A    │  │  Product B    │  │  Product C    │       │
│  │  S&S: ON      │  │  S&S: OFF     │  │  S&S: ON      │       │
│  │  Override:    │  │               │  │  Use defaults │       │
│  │  Monthly=15%  │  │               │  │               │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

**Tenant Config** (stored in `public.tenants.config` JSONB):
```typescript
{
  subscription_defaults: {
    enabled: boolean
    weekly_discount_percent: number    // e.g., 5
    monthly_discount_percent: number   // e.g., 10
    yearly_discount_percent: number    // e.g., 15
  }
}
```

**Product Metadata** (stored in product's `metadata` JSONB):
```typescript
{
  subscribe_and_save: {
    enabled: boolean
    frequencies: [
      { interval: "week", interval_count: 1, enabled: true },
      { interval: "month", interval_count: 1, enabled: true },
      { interval: "year", interval_count: 1, enabled: true }
    ]
    override_discounts?: {
      weekly?: number      // null = use tenant default
      monthly?: number
      yearly?: number
    }
  }
}
```

**ProductSubscription Model** (in tenant schema):
```sql
CREATE TABLE product_subscription (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  interval TEXT DEFAULT 'month',
  interval_count INTEGER DEFAULT 1,
  discount_percent INTEGER DEFAULT 0,
  unit_price INTEGER,
  currency_code TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'active',  -- active, paused, canceled, past_due
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
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/tenants/:slug/subscription-defaults` | Get tenant defaults |
| PATCH | `/admin/tenants/:slug/subscription-defaults` | Update tenant defaults |
| GET | `/admin/products/:id/subscribe-save` | Get product S&S config |
| POST | `/admin/products/:id/subscribe-save` | Configure product S&S |
| DELETE | `/admin/products/:id/subscribe-save` | Disable S&S for product |
| GET | `/store/products/:id/subscription-options` | **Public** - Get options with discounts |

**Store response example:**
```json
{
  "available": true,
  "product_id": "prod_123",
  "options": [
    { "interval": "week", "interval_count": 1, "label": "Weekly", "discount_percent": 5 },
    { "interval": "month", "interval_count": 1, "label": "Monthly", "discount_percent": 10 },
    { "interval": "year", "interval_count": 1, "label": "Yearly", "discount_percent": 15 }
  ]
}
```

### Key Files

| File | Purpose |
|------|---------|
| `src/api/admin/tenants/[slug]/subscription-defaults/route.ts` | Tenant defaults API |
| `src/api/admin/products/[id]/subscribe-save/route.ts` | Product S&S config API |
| `src/api/store/products/[id]/subscription-options/route.ts` | Public S&S options |
| `src/admin/widgets/product-subscribe-save.tsx` | Product detail widget |
| `src/admin/routes/settings/subscriptions/page.tsx` | Tenant S&S settings page |
| `src/modules/subscription/models/product-subscription.ts` | ProductSubscription model |
| `src/jobs/subscribe-save-renewals.ts` | Hourly renewal processing job |

### Renewal Job

The `subscribe-save-renewals` job runs every hour and:
1. Processes overdue subscriptions (charges saved payment methods)
2. Creates renewal orders on successful payment
3. Marks subscriptions `past_due` on failed payment
4. Auto-resumes paused subscriptions when `pause_end` is reached
5. Logs upcoming deliveries for monitoring

```typescript
// Schedule: every hour
export const config = {
  name: "subscribe-save-renewals",
  schedule: "0 * * * *",
}
```

### Payment Charging Implementation

Both Stripe and Authorize.net providers implement `chargePaymentMethod()` for off-session recurring billing:

**Stripe** uses PaymentIntent with off-session:
```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: amount,
  currency: currency,
  customer: customerId,        // cus_xxx
  payment_method: paymentMethodId,  // pm_xxx
  off_session: true,
  confirm: true,
})
```

**Authorize.net** uses CIM (Customer Information Manager):
```typescript
const requestBody = {
  createTransactionRequest: {
    merchantAuthentication: { name, transactionKey },
    transactionRequest: {
      transactionType: "authCaptureTransaction",
      amount: amountInDollars,
      profile: {
        customerProfileId: customerId,
        paymentProfile: { paymentProfileId: paymentMethodId }
      }
    }
  }
}
```

### Customer Product Subscription Endpoints

Full customer portal API for Subscribe & Save management:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/store/product-subscriptions/me` | List all subscriptions |
| GET | `/store/product-subscriptions/me/:id` | Get subscription details |
| POST | `/store/product-subscriptions/me/:id/pause` | Pause with optional resume date |
| POST | `/store/product-subscriptions/me/:id/resume` | Resume paused subscription |
| POST | `/store/product-subscriptions/me/:id/cancel` | Cancel with optional reason |
| POST | `/store/product-subscriptions/me/:id/skip` | Skip next delivery |
| PATCH | `/store/product-subscriptions/me/:id/frequency` | Change frequency (updates discount) |

---

## Per-Tenant Payment Gateway Configuration

### Concept

Each tenant configures their own payment gateways (Stripe, PayPal, Authorize.net). Credentials are encrypted at rest using AES-256-GCM. Multiple gateways can be enabled simultaneously.

```
┌─────────────────────────────────────────────────────────────────┐
│                     TENANT: ATTACK-DOG                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Payment Gateways                                         │    │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │    │
│  │ │ Stripe   │ │ PayPal   │ │ Auth.net │ │ Manual   │     │    │
│  │ │ DEFAULT  │ │ Enabled  │ │ Disabled │ │ Disabled │     │    │
│  │ │ ✓        │ │ ✓        │ │          │ │          │     │    │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

**Tenant Config** (stored in `public.tenants.config` JSONB):
```typescript
{
  payment_gateways: {
    enabled_gateways: ["stripe", "paypal"],  // Order = display order
    default_gateway: "stripe",
    gateways: {
      stripe: {
        api_key_encrypted: "...",           // AES-256-GCM encrypted
        webhook_secret_encrypted: "...",
        publishable_key: "pk_live_...",     // Not encrypted (public)
        sandbox_mode: false,
        updated_at: "2024-01-01T00:00:00Z"
      },
      paypal: {
        client_id_encrypted: "...",
        client_secret_encrypted: "...",
        sandbox_mode: true,
        updated_at: "2024-01-01T00:00:00Z"
      }
    }
  }
}
```

### Encryption Module

**File:** `src/lib/encryption.ts`

Uses AES-256-GCM with:
- Master key from `ENCRYPTION_KEY` environment variable (32 bytes)
- Per-field IV generation for each encryption
- Combined format: `iv:authTag:ciphertext` (base64)

```typescript
// Encrypt payment credentials
const encrypted = encryptStripeCredentials({
  api_key: "sk_live_xxx",
  webhook_secret: "whsec_xxx",
  publishable_key: "pk_live_xxx"
})

// Decrypt for use
const decrypted = decryptStripeCredentials(encrypted)
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/tenants/:slug/payment-gateways` | List configured gateways (masked keys) |
| POST | `/admin/tenants/:slug/payment-gateways` | Configure gateway |
| PATCH | `/admin/tenants/:slug/payment-gateways/:gateway_id` | Enable/disable/set default |
| DELETE | `/admin/tenants/:slug/payment-gateways/:gateway_id` | Remove gateway |
| GET | `/store/payment-gateways` | List enabled gateways for checkout |

### Tenant-Aware Billing Provider

**File:** `src/modules/subscription/providers/index.ts`

The provider factory decrypts tenant credentials and creates provider instances:

```typescript
// Get provider with tenant-specific credentials
const provider = getBillingProviderForTenant("stripe", tenantConfig)

// If tenant has configured Stripe, uses their credentials
// Otherwise falls back to environment variables
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/encryption.ts` | AES-256-GCM encryption module |
| `src/api/admin/tenants/[slug]/payment-gateways/route.ts` | Gateway list & configure |
| `src/api/admin/tenants/[slug]/payment-gateways/[gateway_id]/route.ts` | Gateway enable/disable |
| `src/api/store/payment-gateways/route.ts` | Public gateway list |
| `src/admin/routes/settings/payments/page.tsx` | Gateway settings UI |
| `src/modules/subscription/providers/index.ts` | Tenant-aware provider factory |

### Admin UI

The Payment Settings page (`/app/settings/payments`) provides:
- Gateway cards showing configuration status
- Enable/disable toggles
- Set default gateway
- Configuration forms per gateway type
- Sandbox mode indicators
- Masked credential display

### Settings Sidebar Integration

Both settings pages appear in the Settings sidebar using `defineRouteConfig`:

```typescript
// src/admin/routes/settings/subscriptions/page.tsx
import { defineRouteConfig } from "@medusajs/admin-sdk"

export const config = defineRouteConfig({
  label: "Subscribe & Save",
})

// src/admin/routes/settings/payments/page.tsx
export const config = defineRouteConfig({
  label: "Payment Gateways",
})
```

Pages under `src/admin/routes/settings/*/page.tsx` automatically appear in the Settings sidebar when they export a `config` with a `label`.

### Environment Variables

```bash
# Required for credential encryption (32 bytes, base64 encoded)
ENCRYPTION_KEY=your-32-byte-key-base64-encoded

# Fallback gateway credentials (used if tenant hasn't configured their own)
STRIPE_API_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Security Considerations

1. **Encryption at rest**: All payment credentials use AES-256-GCM with unique IVs
2. **Key management**: Master key in `ENCRYPTION_KEY` env var only (never in DB)
3. **Access control**: Only super admins and tenant owners can configure gateways
4. **Masked display**: API keys shown as `sk_live_...xxx` in admin UI
5. **Audit logging**: Payment configuration changes are logged
6. **Webhook isolation**: Each tenant verifies webhooks with their own secret

---

## References

- [Igor Khomenko - Multivendor Marketplace Part 1](https://medium.com/@igorkhomenko/building-a-multivendor-marketplace-with-medusa-js-2-0-a-dev-guide-f55aec971126)
- [Igor Khomenko - Super Admin Part 2](https://medium.com/@igorkhomenko/building-a-multivendor-marketplace-with-medusa-js-2-0-super-admin-d899353b0b1e)
- [Igor Khomenko - Dashboard Customization Part 3](https://medium.com/@igorkhomenko/building-a-multivendor-marketplace-with-medusa-js-2-0-dashboard-customization-part-3-6ce584b8c1c1)
- [Igor Khomenko - Medusa Plugin Part 4](https://medium.com/@igorkhomenko/building-a-multivendor-marketplace-with-medusa-js-2-0-medusa-plugin-part-4-a4c7ac08f2d4)
- [Medusa Marketplace Recipe](https://docs.medusajs.com/resources/recipes/marketplace/examples/vendors)
- [@techlabi/medusa-marketplace-plugin](https://www.npmjs.com/package/@techlabi/medusa-marketplace-plugin)
