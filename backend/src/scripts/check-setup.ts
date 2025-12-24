import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function checkSetup({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info("Checking Medusa setup...")
  logger.info("=".repeat(50))

  // Check stores
  const storeService = container.resolve(Modules.STORE)
  const stores = await storeService.listStores({})
  logger.info(`Stores: ${stores.length}`)
  for (const store of stores) {
    logger.info(`  - ${store.name} (ID: ${store.id})`)
  }

  // Check sales channels
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const salesChannels = await salesChannelService.listSalesChannels({})
  logger.info(`Sales Channels: ${salesChannels.length}`)
  for (const sc of salesChannels) {
    logger.info(`  - ${sc.name} (ID: ${sc.id})`)
  }

  // Check regions
  const regionService = container.resolve(Modules.REGION)
  const regions = await regionService.listRegions({})
  logger.info(`Regions: ${regions.length}`)
  for (const r of regions) {
    logger.info(`  - ${r.name} (${r.currency_code})`)
  }

  // Check users
  const userService = container.resolve(Modules.USER)
  const users = await userService.listUsers({})
  logger.info(`Users: ${users.length}`)
  for (const u of users) {
    logger.info(`  - ${u.email} (ID: ${u.id})`)
  }

  // Check API keys
  const apiKeyService = container.resolve(Modules.API_KEY)
  const apiKeys = await apiKeyService.listApiKeys({})
  logger.info(`API Keys: ${apiKeys.length}`)
  for (const key of apiKeys) {
    logger.info(`  - ${key.title} (Type: ${key.type})`)
  }

  // Check payment providers
  try {
    const paymentService = container.resolve(Modules.PAYMENT)
    const paymentProviders = await paymentService.listPaymentProviders({})
    logger.info(`Payment Providers: ${paymentProviders.length}`)
    for (const p of paymentProviders) {
      logger.info(`  - ${p.id}`)
    }
  } catch (e: any) {
    logger.info(`Payment Providers: Not configured`)
  }

  // Check fulfillment providers
  try {
    const fulfillmentService = container.resolve(Modules.FULFILLMENT)
    const fulfillmentProviders = await fulfillmentService.listFulfillmentProviders({})
    logger.info(`Fulfillment Providers: ${fulfillmentProviders.length}`)
    for (const f of fulfillmentProviders) {
      logger.info(`  - ${f.id}`)
    }
  } catch (e: any) {
    logger.info(`Fulfillment Providers: Not configured`)
  }

  logger.info("=".repeat(50))
  logger.info("Setup check completed!")
}
