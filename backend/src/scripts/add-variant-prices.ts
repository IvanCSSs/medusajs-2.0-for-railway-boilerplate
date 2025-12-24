/**
 * Script to add default prices to all product variants that don't have prices
 * This fixes the admin UI crash when trying to edit variant prices
 *
 * Run with: npx medusa exec ./src/scripts/add-variant-prices.ts
 */

import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function addVariantPrices({ container }: ExecArgs) {
  const productService = container.resolve(Modules.PRODUCT)
  const pricingService = container.resolve(Modules.PRICING)
  const linkService = container.resolve("remoteLink")
  const query = container.resolve("query")

  console.log("Fetching all products with variants...")

  // Get all products with their variants and prices
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.prices.*",
    ],
  })

  console.log(`Found ${products.length} products`)

  let variantsWithoutPrices = 0
  let variantsFixed = 0

  for (const product of products) {
    for (const variant of product.variants || []) {
      const hasPrices = variant.prices && variant.prices.length > 0

      if (!hasPrices) {
        variantsWithoutPrices++
        console.log(`Variant without prices: ${variant.sku || variant.id} (${product.title})`)

        try {
          // Create a price set for this variant
          const priceSet = await pricingService.createPriceSets({
            prices: [
              {
                amount: 0, // Default price of $0, user can update later
                currency_code: "usd",
              },
            ],
          })

          // Link the price set to the variant
          await linkService.create({
            [Modules.PRODUCT]: {
              variant_id: variant.id,
            },
            [Modules.PRICING]: {
              price_set_id: priceSet.id,
            },
          })

          variantsFixed++
          console.log(`  ✓ Added price set for ${variant.sku || variant.id}`)
        } catch (error) {
          console.error(`  ✗ Failed to add price for ${variant.sku || variant.id}:`, error)
        }
      }
    }
  }

  console.log(`\nSummary:`)
  console.log(`  Variants without prices: ${variantsWithoutPrices}`)
  console.log(`  Variants fixed: ${variantsFixed}`)
}
