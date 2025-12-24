import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Collections based on product categories
const collections = [
  {
    title: "Bubble Gum",
    handle: "bubble-gum",
    productHandles: [
      "yum-delicious-kratom-extract-bubble-gum-14ml",
      "155-bg-yum-14ml-case",
      "155-bg-yum-14ml-tray",
      "twins-yum-delicious-kratom-extract-bubble-gum-30ml",
      "yum-delicious-kratom-extract-bubble-gum",
      "333-bg-yum-30ml-master-case",
      "333-bg-yum-30ml-case",
      "333-bg-yum-30ml-tray",
      "yum-triple-play-kratom-extract-bubble-gum-flavor",
      "triple-play-yum-delicious-kratom-extract-bubble-gum-14ml",
      "yum-delicious-kratom-extract-bubble-gum-14ml-6-units",
      "yum-delicious-kratom-extract-case-bubble-gum-16-units",
      "yum-delicious-kratom-extract-collection-bubble-gum-30ml-32-units",
      "yum-delicious-kratom-extract-collection-bubble-gum-30ml-12-units",
      "yum-delicious-kratom-extract-collection-bubble-gum-30ml-32-units-1",
    ],
  },
  {
    title: "Tropical Breeze",
    handle: "tropical-breeze",
    productHandles: [
      "yum-tropical-breeze-14ml-by-luna",
      "155-bg-yum-14ml-master-case",
      "333-tropical-breeze-yum-30ml-twins",
      "333-yum-tropical-breeze-30ml-by-luna",
      "triple-play-yum-tropical-breeze-30ml-delicious-kratom-extract",
    ],
  },
  {
    title: "Bundles & Samplers",
    handle: "bundles",
    productHandles: [
      "333-bubble-gum-tropical-breeze-big-pack",
      "333-sample-pack-single",
      "333-bubble-gum-tropical-breeze-yum-holiday-bundle-6-units",
      "klear-kryptonite-cleaner-470ml-luna-yum-bottle",
    ],
  },
  {
    title: "14ml Bottles",
    handle: "14ml-bottles",
    productHandles: [
      "yum-delicious-kratom-extract-bubble-gum-14ml",
      "yum-tropical-breeze-14ml-by-luna",
      "triple-play-yum-delicious-kratom-extract-bubble-gum-14ml",
      "yum-delicious-kratom-extract-bubble-gum-14ml-6-units",
      "yum-delicious-kratom-extract-collection-bubble-gum-30ml-32-units",
    ],
  },
  {
    title: "30ml Bottles",
    handle: "30ml-bottles",
    productHandles: [
      "twins-yum-delicious-kratom-extract-bubble-gum-30ml",
      "yum-delicious-kratom-extract-bubble-gum",
      "333-tropical-breeze-yum-30ml-twins",
      "333-yum-tropical-breeze-30ml-by-luna",
      "yum-triple-play-kratom-extract-bubble-gum-flavor",
      "triple-play-yum-tropical-breeze-30ml-delicious-kratom-extract",
      "yum-delicious-kratom-extract-case-bubble-gum-16-units",
      "yum-delicious-kratom-extract-collection-bubble-gum-30ml-12-units",
      "yum-delicious-kratom-extract-collection-bubble-gum-30ml-32-units-1",
    ],
  },
  {
    title: "Wholesale",
    handle: "wholesale",
    productHandles: [
      "155-bg-yum-14ml-case",
      "155-bg-yum-14ml-tray",
      "155-bg-yum-14ml-master-case",
      "333-bg-yum-30ml-master-case",
      "333-bg-yum-30ml-case",
      "333-bg-yum-30ml-tray",
      "yum-delicious-kratom-extract-bubble-gum-14ml-6-units",
      "yum-delicious-kratom-extract-case-bubble-gum-16-units",
      "yum-delicious-kratom-extract-collection-bubble-gum-30ml-32-units",
      "yum-delicious-kratom-extract-collection-bubble-gum-30ml-12-units",
      "yum-delicious-kratom-extract-collection-bubble-gum-30ml-32-units-1",
    ],
  },
]

export default async function setupCollections({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productService = container.resolve(Modules.PRODUCT)

  logger.info("Setting up product collections...")

  for (const collection of collections) {
    try {
      // Check if collection exists
      const existing = await productService.listProductCollections({ handle: collection.handle })

      let collectionId: string

      if (existing.length > 0) {
        collectionId = existing[0].id
        logger.info(`Collection already exists: ${collection.title}`)
      } else {
        // Create collection
        const created = await productService.createProductCollections({
          title: collection.title,
          handle: collection.handle,
        } as any)
        const newCollection = Array.isArray(created) ? created[0] : created
        collectionId = newCollection.id
        logger.info(`Created collection: ${collection.title}`)
      }

      // Add products to collection
      let addedCount = 0
      for (const productHandle of collection.productHandles) {
        try {
          const products = await productService.listProducts({ handle: productHandle })

          if (products.length > 0) {
            const product = products[0]

            // Update product to add to collection
            await productService.updateProducts(product.id, {
              collection_id: collectionId,
            } as any)
            addedCount++
          }
        } catch (err: any) {
          // Product might not exist, skip it
        }
      }

      logger.info(`  - Added ${addedCount} products to ${collection.title}`)

    } catch (error: any) {
      logger.error(`Failed to setup collection ${collection.title}: ${error.message}`)
    }
  }

  logger.info("=".repeat(50))
  logger.info("Collections setup completed!")
  logger.info(`Created/Updated ${collections.length} collections:`)
  for (const c of collections) {
    logger.info(`  - ${c.title} (${c.productHandles.length} products)`)
  }
  logger.info("=".repeat(50))
}
