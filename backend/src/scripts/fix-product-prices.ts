import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function fixProductPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productService = container.resolve(Modules.PRODUCT)
  const pricingService = container.resolve(Modules.PRICING)
  const regionService = container.resolve(Modules.REGION)

  logger.info("Checking product pricing setup...")

  try {
    // Get USD region
    const regions = await regionService.listRegions({ currency_code: "usd" })
    if (regions.length === 0) {
      logger.error("No USD region found!")
      return
    }
    const usdRegion = regions[0]
    logger.info(`Found USD region: ${usdRegion.name} (${usdRegion.id})`)

    // List all products with variants
    const products = await productService.listProducts({}, { relations: ["variants", "variants.prices"] })
    logger.info(`Found ${products.length} products`)

    let fixed = 0
    for (const product of products) {
      for (const variant of product.variants || []) {
        // Check if variant has prices
        const prices = variant.prices || []
        logger.info(`  ${variant.title}: ${prices.length} prices`)

        if (prices.length === 0) {
          logger.warn(`    No prices for variant ${variant.id}`)
        } else {
          for (const price of prices) {
            logger.info(`    - ${price.currency_code}: ${price.amount}`)
          }
        }
      }
    }

    // Check price sets
    const priceSets = await pricingService.listPriceSets({})
    logger.info(`Total price sets: ${priceSets.length}`)

    // Check price rules
    const priceRules = await pricingService.listPriceRules({})
    logger.info(`Total price rules: ${priceRules.length}`)

    logger.info("=".repeat(50))
    logger.info("Price check completed!")

  } catch (error: any) {
    logger.error("Error:", error.message)
    throw error
  }
}
