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

- [ ] Remove `/storefront` directory
- [ ] Remove MeiliSearch from Railway config
- [ ] Remove MinIO from Railway config
- [ ] Clean up unused env vars

### Phase 2: Tenant Infrastructure

- [ ] Create tenant registry table
- [ ] Build tenant middleware
- [ ] Implement schema switching module
- [ ] Implement Redis namespacing

### Phase 3: Store Management

- [ ] Build `create-store.ts` script
- [ ] Build `delete-store.ts` script
- [ ] Build `list-stores.ts` script
- [ ] Build `migrate-all.ts` script

### Phase 4: Testing

- [ ] Test with 2 stores locally
- [ ] Test domain routing
- [ ] Test data isolation

### Phase 5: Deploy

- [ ] Deploy to Railway
- [ ] Configure custom domains
- [ ] Verify production setup

---

## Known Challenges

| Challenge | Solution |
|-----------|----------|
| MikroORM caches schema | Fork EntityManager per request |
| Background jobs lack context | Store `tenantSchema` in job payload |
| Admin panel routing | Each domain's `/admin` routes to its schema |
| Cross-tenant queries | Use `public` schema or explicit schema prefix |

---

## Railway Services (Final)

| Service | Purpose |
|---------|---------|
| **medusa-backend** | Main API (multi-tenant) |
| **postgres** | Shared DB with schemas |
| **redis** | Shared cache with prefixes |

**Three services, unlimited stores.**

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
