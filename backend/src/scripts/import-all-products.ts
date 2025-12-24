import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

// All 24 Shopify products (without images)
const shopifyProducts = [
  {
    title: "155 - YUM Delicious Kratom Extract - Bubble Gum 14ml",
    handle: "yum-delicious-kratom-extract-bubble-gum-14ml",
    status: "draft",
    description: "Irresistible YUM Kratom Extract with delightful bubble gum flavor. 75% concentrated MITRAGYNA in each 14ml bottle. Perfect for mixing mocktails.",
    variants: [{ title: "Default", sku: "YUM-BG-14ml-1", price: 1699, barcode: "00857607004821", weight: 1.1 }],
  },
  {
    title: "155 - YUM Tropical Breeze 14ml by LUNA",
    handle: "yum-tropical-breeze-14ml-by-luna",
    status: "draft",
    description: "YUM Kratom Extract Tropical Breeze flavor. Refreshing tropical fruits blend with 75% concentrated MITRAGYNA. Perfect for mocktails.",
    variants: [{ title: "Default", sku: "YUM-TB-14ml-1", price: 1699, barcode: "857607004845", weight: 0 }],
  },
  {
    title: "155-BG-YUM-14ml-Sleeve",
    handle: "155-bg-yum-14ml-case",
    status: "draft",
    description: "YUM Bubble Gum 14ml Sleeve Pack",
    variants: [{ title: "Default", sku: "YUM-BG-14ml-Case", price: 82500, barcode: "", weight: 6.0 }],
  },
  {
    title: "155-BG-YUM-14ml-Tray",
    handle: "155-bg-yum-14ml-tray",
    status: "draft",
    description: "YUM Bubble Gum 14ml Tray",
    variants: [{ title: "Default", sku: "YUM-BG-14ml-Tray", price: 21250, barcode: "", weight: 0 }],
  },
  {
    title: "155-TB-YUM-14ml-Case",
    handle: "155-bg-yum-14ml-master-case",
    status: "draft",
    description: "YUM Tropical Breeze 14ml Master Case. 75% concentrated MITRAGYNA.",
    variants: [{ title: "Default", sku: "YUM-TB-14ml-Case", price: 360000, barcode: "", weight: 0 }],
  },
  {
    title: "333 - Bubble Gum & Tropical Breeze Big Pack",
    handle: "333-bubble-gum-tropical-breeze-big-pack",
    status: "draft",
    description: "YUM Bubble Gum + Tropical Breeze Bundle Big Pack. Both flavors with 75% concentrated MITRAGYNA in 30ml bottles.",
    variants: [{ title: "Default", sku: "YUM-BG-TB-BigPack", price: 0, barcode: "", weight: 0 }],
  },
  {
    title: "333 - Bubble Gum & Tropical Breeze Sampler Pack",
    handle: "333-sample-pack-single",
    status: "published",
    description: "Try Them Both: YUM Bubble Gum + Tropical Breeze Bundle. One of each flavor with 75% concentrated MITRAGYNA in 30ml bottles.",
    variants: [{ title: "Default", sku: "YUM-SAMPLER-2", price: 4800, barcode: "", weight: 2.6 }],
  },
  {
    title: "333 - Bubble Gum + Tropical Breeze YUM Holiday Bundle (6 Units)",
    handle: "333-bubble-gum-tropical-breeze-yum-holiday-bundle-6-units",
    status: "published",
    description: "YUM Holiday Bundle: 3 Bubble Gum and 3 Tropical Breeze Kratom Extract. 75% concentrated MITRAGYNA in every 30ml bottle.",
    variants: [{ title: "Default", sku: "YUM-HOLIDAY-6", price: 14000, barcode: "", weight: 0 }],
  },
  {
    title: "333 - Tropical Breeze YUM 30ml Twins",
    handle: "333-tropical-breeze-yum-30ml-twins",
    status: "published",
    description: "TWINS Play - YUM Tropical Breeze! Two 30ml bottles with 75% concentrated MITRAGYNA. Refreshing tropical fruits blend.",
    variants: [{ title: "Default", sku: "TB-YUM-30ml-2pack", price: 4800, barcode: "", weight: 0 }],
  },
  {
    title: "333 - TWINS YUM Delicious Kratom Extract - Bubble Gum 30ml",
    handle: "twins-yum-delicious-kratom-extract-bubble-gum-30ml",
    status: "published",
    description: "TWINS Play - YUM Bubble Gum Kratom Extract. Two 30ml bottles with 75% concentrated MITRAGYNA.",
    variants: [{ title: "Default", sku: "BG-YUM-30ml-2pack", price: 4800, barcode: null, weight: 3.6 }],
  },
  {
    title: "333 - YUM Delicious Kratom Extract - Bubble Gum 30ml",
    handle: "yum-delicious-kratom-extract-bubble-gum",
    status: "published",
    description: "Irresistible YUM Kratom Extract with delightful bubble gum flavor. 75% concentrated MITRAGYNA in each 30ml bottle.",
    variants: [{ title: "Default", sku: "LY250BS-W", price: 2499, barcode: "857607004739", weight: 1.2 }],
  },
  {
    title: "333 - YUM Tropical Breeze 30ml by LUNA",
    handle: "333-yum-tropical-breeze-30ml-by-luna",
    status: "draft",
    description: "YUM Kratom Extract Tropical Breeze flavor. 30ml bottle with 75% concentrated MITRAGYNA.",
    variants: [{ title: "Default", sku: "YUM-TB-30ml-1", price: 2499, barcode: "857607004838", weight: 0 }],
  },
  {
    title: "333-BG-YUM-30ml-Case (300 Units)",
    handle: "333-bg-yum-30ml-master-case",
    status: "draft",
    description: "YUM Bubble Gum 30ml Master Case - 300 Units",
    variants: [{ title: "Default", sku: "YUM-BG-30ml-MasterCase", price: 0, barcode: "", weight: 0 }],
  },
  {
    title: "333-BG-YUM-30ml-Sleeve",
    handle: "333-bg-yum-30ml-case",
    status: "draft",
    description: "YUM Bubble Gum 30ml Sleeve Pack",
    variants: [{ title: "Default", sku: "YUM-BG-30ml-Sleeve", price: 62500, barcode: "", weight: 0 }],
  },
  {
    title: "333-BG-YUM-30ml-Tray",
    handle: "333-bg-yum-30ml-tray",
    status: "draft",
    description: "YUM Bubble Gum 30ml Tray",
    variants: [{ title: "Default", sku: "YUM-BG-30ml-Tray", price: 0, barcode: "", weight: 0 }],
  },
  {
    title: "KLEAR™ Kryptonite Cleaner 470ml + LUNA YUM bottle",
    handle: "klear-kryptonite-cleaner-470ml-luna-yum-bottle",
    status: "draft",
    description: "One 470ml bottle of KLEAR™ Kryptonite Cleaner + 1 FREE BOTTLE of LUNA YUM Bubble Gum 30ml.",
    variants: [{ title: "Default", sku: "KLEAR-YUM-BUNDLE", price: 1899, barcode: "", weight: 0 }],
  },
  {
    title: "Triple Play - YUM Delicious Kratom Extract - Bubble Gum 14ml",
    handle: "triple-play-yum-delicious-kratom-extract-bubble-gum-14ml",
    status: "draft",
    description: "Triple Play - Three 14ml bottles of YUM Bubble Gum Kratom Extract. 75% concentrated MITRAGYNA.",
    variants: [{ title: "Default", sku: "BG-YUM-314ml-3pack", price: 4800, barcode: "", weight: 0 }],
  },
  {
    title: "Triple Play - YUM Delicious Kratom Extract - Bubble Gum 30ml",
    handle: "yum-triple-play-kratom-extract-bubble-gum-flavor",
    status: "published",
    description: "Triple Play - Three 30ml bottles of YUM Bubble Gum Kratom Extract. 75% concentrated MITRAGYNA.",
    variants: [{ title: "Default", sku: "YUM-BG-30ML-3", price: 7000, barcode: "", weight: 3.6 }],
  },
  {
    title: "Triple Play - YUM Tropical Breeze 30ml Delicious Kratom Extract",
    handle: "triple-play-yum-tropical-breeze-30ml-delicious-kratom-extract",
    status: "published",
    description: "Triple Play - Three 30ml bottles of YUM Tropical Breeze Kratom Extract. 75% concentrated MITRAGYNA.",
    variants: [{ title: "Default", sku: "TB-YUM-30ml-3pack", price: 7000, barcode: "", weight: 0.4 }],
  },
  {
    title: "YUM Delicious Kratom Extract - Bubble Gum 14ml (6 Units)",
    handle: "yum-delicious-kratom-extract-bubble-gum-14ml-6-units",
    status: "draft",
    description: "YUM Bubble Gum 14ml - 6 bottle collection. 75% concentrated MITRAGYNA in each bottle.",
    variants: [{ title: "Default", sku: "YUM-BG-14ml-6pack", price: 10203, barcode: "", weight: 0 }],
  },
  {
    title: "YUM Delicious Kratom Extract - Bubble Gum 30ml (6 Units)",
    handle: "yum-delicious-kratom-extract-case-bubble-gum-16-units",
    status: "draft",
    description: "YUM Bubble Gum 30ml - 6 bottle collection. 75% concentrated MITRAGYNA in each bottle.",
    variants: [{ title: "Default", sku: "LY250BS-W-Case", price: 13912, barcode: null, weight: 24.0 }],
  },
  {
    title: "YUM Delicious Kratom Extract Collection - Bubble Gum 14ml (32 Units)",
    handle: "yum-delicious-kratom-extract-collection-bubble-gum-30ml-32-units",
    status: "draft",
    description: "YUM Bubble Gum 14ml - 32 bottle collection for retailers. 75% concentrated MITRAGYNA.",
    variants: [{ title: "Default", sku: "YUM-BG-14ml-32pack", price: 54236, barcode: "", weight: 0 }],
  },
  {
    title: "YUM Delicious Kratom Extract Collection - Bubble Gum 30ml (12 Units)",
    handle: "yum-delicious-kratom-extract-collection-bubble-gum-30ml-12-units",
    status: "draft",
    description: "YUM Bubble Gum 30ml - 12 bottle collection. 75% concentrated MITRAGYNA in each bottle.",
    variants: [{ title: "Default", sku: "YUM-BG-30ml-12pack", price: 27825, barcode: "", weight: 0 }],
  },
  {
    title: "YUM Delicious Kratom Extract Collection - Bubble Gum 30ml (32 Units)",
    handle: "yum-delicious-kratom-extract-collection-bubble-gum-30ml-32-units-1",
    status: "draft",
    description: "YUM Bubble Gum 30ml - 32 bottle collection for retailers. 75% concentrated MITRAGYNA.",
    variants: [{ title: "Default", sku: "YUM-BG-30ml-32pack", price: 74200, barcode: "", weight: 0 }],
  },
]

export default async function importAllProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productService = container.resolve(Modules.PRODUCT)

  logger.info("Starting import of ALL Shopify products...")
  logger.info(`Total products to import: ${shopifyProducts.length}`)

  // Get or create collection
  const collections = await productService.listProductCollections({ handle: "yum-kratom" })
  let yumCollection = collections[0]

  if (!yumCollection) {
    const created = await productService.createProductCollections({
      title: "YUM Kratom Extracts",
      handle: "yum-kratom",
    } as any)
    yumCollection = Array.isArray(created) ? created[0] : created
    logger.info("Created YUM Kratom collection")
  }

  let imported = 0
  let skipped = 0
  let errors = 0

  for (const product of shopifyProducts) {
    try {
      // Check if product already exists
      const existing = await productService.listProducts({ handle: product.handle })

      if (existing.length > 0) {
        logger.info(`Skipping existing: ${product.title}`)
        skipped++
        continue
      }

      // Create the product without images
      await productService.createProducts({
        title: product.title,
        handle: product.handle,
        description: product.description,
        status: product.status,
        collection_id: yumCollection?.id,
        options: [
          {
            title: "Size",
            values: ["Default"],
          }
        ],
        variants: product.variants.map(v => ({
          title: v.title,
          sku: v.sku || undefined,
          barcode: v.barcode || undefined,
          manage_inventory: false,
          weight: v.weight || undefined,
          prices: [{ amount: v.price, currency_code: "usd" }],
          options: {
            Size: "Default",
          }
        })),
      } as any)

      imported++
      logger.info(`Imported: ${product.title}`)

    } catch (error: any) {
      errors++
      logger.error(`Failed to import ${product.title}: ${error.message}`)
    }
  }

  logger.info("=".repeat(50))
  logger.info("Product import completed!")
  logger.info(`- Imported: ${imported}`)
  logger.info(`- Skipped (existing): ${skipped}`)
  logger.info(`- Errors: ${errors}`)
  logger.info(`- Total: ${shopifyProducts.length}`)
  logger.info("=".repeat(50))
}
