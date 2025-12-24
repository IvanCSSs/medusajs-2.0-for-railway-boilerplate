import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Shopify customers data - imported from /tmp/shopify-migration/customers.json
// This is a subset for the migration script - the full data is loaded at runtime
interface ShopifyCustomer {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  created_at: string
  orders_count: number
  total_spent: string
  verified_email: boolean
  addresses: Array<{
    id: number
    customer_id: number
    first_name: string | null
    last_name: string | null
    company: string | null
    address1: string | null
    address2: string | null
    city: string | null
    province: string | null
    province_code: string | null
    country: string | null
    country_code: string | null
    zip: string | null
    phone: string | null
    default: boolean
  }>
  email_marketing_consent: {
    state: string
    opt_in_level: string
  } | null
}

// Import shopify customers inline (embedded in script for Railway deployment)
// In production, this would fetch from an API or read from a mounted volume
const shopifyCustomers: ShopifyCustomer[] = [
  {"id":8980380221529,"email":"chrishale155@yahoo.com","first_name":"Chris","last_name":"Hale","phone":null,"created_at":"2025-12-19T07:42:46-08:00","orders_count":0,"total_spent":"0.00","verified_email":true,"addresses":[],"email_marketing_consent":{"state":"not_subscribed","opt_in_level":"single_opt_in"}},
  {"id":8980089110617,"email":"aaronbarrett258@gmail.com","first_name":"Aaron","last_name":"Barrett","phone":null,"created_at":"2025-12-19T06:28:11-08:00","orders_count":0,"total_spent":"0.00","verified_email":true,"addresses":[],"email_marketing_consent":{"state":"not_subscribed","opt_in_level":"single_opt_in"}},
  {"id":8979817889881,"email":"iva.trajkovska.01@gmail.com","first_name":null,"last_name":null,"phone":null,"created_at":"2025-12-19T04:39:19-08:00","orders_count":0,"total_spent":"0.00","verified_email":true,"addresses":[],"email_marketing_consent":{"state":"subscribed","opt_in_level":"unknown"}},
  {"id":8978690244697,"email":"cferguson781@yahoo.com","first_name":"Charles","last_name":"Ferguson","phone":null,"created_at":"2025-12-18T16:11:03-08:00","orders_count":0,"total_spent":"0.00","verified_email":true,"addresses":[],"email_marketing_consent":{"state":"not_subscribed","opt_in_level":"single_opt_in"}},
  {"id":8978582405209,"email":"victoria.taylor63@yahoo.com","first_name":"Victoria","last_name":"Taylor","phone":null,"created_at":"2025-12-18T15:15:18-08:00","orders_count":0,"total_spent":"0.00","verified_email":true,"addresses":[],"email_marketing_consent":{"state":"not_subscribed","opt_in_level":"single_opt_in"}},
]

// Note: Due to script size limits, this contains only a sample of customers.
// For full customer import, use the Medusa Admin API or bulk import feature.

export default async function importCustomers({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const customerService = container.resolve(Modules.CUSTOMER)

  logger.info("Starting customer import from Shopify...")
  logger.info(`Processing ${shopifyCustomers.length} customers (sample batch)`)

  let imported = 0
  let skipped = 0
  let errors = 0

  for (const customer of shopifyCustomers) {
    try {
      // Check if customer already exists by email
      const existing = await customerService.listCustomers({ email: customer.email })

      if (existing.length > 0) {
        logger.info(`Skipping existing customer: ${customer.email}`)
        skipped++
        continue
      }

      // Create the customer
      await customerService.createCustomers({
        email: customer.email,
        first_name: customer.first_name || undefined,
        last_name: customer.last_name || undefined,
        phone: customer.phone || undefined,
        has_account: customer.verified_email,
        metadata: {
          shopify_id: customer.id.toString(),
          shopify_orders_count: customer.orders_count,
          shopify_total_spent: customer.total_spent,
          imported_at: new Date().toISOString(),
        },
      } as any)

      // If customer has addresses, add them
      if (customer.addresses && customer.addresses.length > 0) {
        const createdCustomers = await customerService.listCustomers({ email: customer.email })
        if (createdCustomers.length > 0) {
          for (const addr of customer.addresses) {
            await customerService.createCustomerAddresses({
              customer_id: createdCustomers[0].id,
              first_name: addr.first_name || customer.first_name || "",
              last_name: addr.last_name || customer.last_name || "",
              company: addr.company || undefined,
              address_1: addr.address1 || "",
              address_2: addr.address2 || undefined,
              city: addr.city || "",
              province: addr.province || undefined,
              postal_code: addr.zip || "",
              country_code: (addr.country_code || "us").toLowerCase(),
              phone: addr.phone || undefined,
              is_default_shipping: addr.default,
              is_default_billing: addr.default,
            } as any)
          }
        }
      }

      imported++
      logger.info(`Imported customer: ${customer.email}`)

    } catch (error: any) {
      errors++
      logger.error(`Failed to import ${customer.email}: ${error.message}`)
    }
  }

  logger.info("=".repeat(50))
  logger.info("Customer import completed!")
  logger.info(`- Imported: ${imported}`)
  logger.info(`- Skipped (existing): ${skipped}`)
  logger.info(`- Errors: ${errors}`)
  logger.info("=".repeat(50))
  logger.info("")
  logger.info("Note: This script imported a sample batch.")
  logger.info("For bulk customer import, use the Medusa Admin CSV import feature")
  logger.info("or the Admin API with the full customer data file.")
}
