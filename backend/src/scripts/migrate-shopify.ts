import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Shopify data from export
const shopifyProducts = [
  {
    title: "333 - Bubble Gum & Tropical Breeze Sampler Pack",
    handle: "333-sample-pack-single",
    description: `<p><strong>Try Them Both: YUM Bubble Gum + Tropical Breeze Bundle</strong><br>Why settle for just one irresistible flavor? With our new YUM Bundle, you get one Bubble Gum and one Tropical Breeze Kratom Extract, giving you the perfect opportunity to enjoy two of our most delicious blends at a great price!</p>
<p>Tropical Breeze captures the essence of your favorite tropical fruits, delivering a fresh and invigorating escape, while Bubble Gum is a sweet and nostalgic delight for your taste buds. Both crafted with 75% concentrated MITRAGYNA in every 30ml bottle, YUM blends are perfect for mixing into your favorite mocktails or enjoying on their own.</p>`,
    images: ["https://cdn.shopify.com/s/files/1/0592/7016/8665/files/2BG-TBpack30ml_v1.png?v=1758063082"],
    variants: [
      {
        title: "Default",
        sku: "YUM-SAMPLER-2",
        prices: [{ amount: 4800, currency_code: "usd" }],
        manage_inventory: false,
        weight: 74,
      }
    ],
    tags: ["Kratom", "YUM", "Bundle"],
  },
  {
    title: "333 - Bubble Gum + Tropical Breeze YUM Holiday Bundle (6 Units)",
    handle: "333-bubble-gum-tropical-breeze-yum-holiday-bundle-6-units",
    description: `<p><strong>Tried Them, Love Them: YUM Bubble Gum + Tropical Breeze Holiday Bundle</strong><br>With our new YUM Holiday Bundle, you get 3 Bubble Gum and 3 Tropical Breeze Kratom Extract, giving you the perfect opportunity to enjoy two of our most delicious blends at a great price!</p>`,
    images: [
      "https://cdn.shopify.com/s/files/1/0592/7016/8665/files/6_mixed_pack_30ml_v1.png?v=1758062465",
      "https://cdn.shopify.com/s/files/1/0592/7016/8665/files/6_mixed_pack_30ml_v2.png?v=1758062466"
    ],
    variants: [
      {
        title: "Default",
        sku: "YUM-HOLIDAY-6",
        prices: [{ amount: 14000, currency_code: "usd" }],
        manage_inventory: false,
      }
    ],
    tags: ["Kratom", "YUM", "Bundle", "Holiday"],
  },
  {
    title: "333 - Tropical Breeze YUM 30ml Twins",
    handle: "333-tropical-breeze-yum-30ml-twins",
    description: `<p><strong>Double the Tropical Bliss: YUM Tropical Breeze 30ml Twins</strong><br>Get two bottles of our refreshing Tropical Breeze Kratom Extract! This vibrant blend captures the essence of your favorite tropical fruits, delivering a fresh and invigorating experience with 75% concentrated MITRAGYNA in each bottle.</p>`,
    images: ["https://cdn.shopify.com/s/files/1/0592/7016/8665/files/Twins_TB_30ml_pack.png?v=1758062897"],
    variants: [
      {
        title: "Default",
        sku: "YUM-TB-30ml-TWINS",
        prices: [{ amount: 4800, currency_code: "usd" }],
        manage_inventory: false,
      }
    ],
    tags: ["Kratom", "YUM", "Tropical Breeze"],
  },
  {
    title: "333 - TWINS YUM Delicious Kratom Extract - Bubble Gum 30ml",
    handle: "twins-yum-delicious-kratom-extract-bubble-gum-30ml",
    description: `<p><strong>Double Your Delight: YUM Bubble Gum 30ml Twins</strong><br>Get two bottles of our irresistible Bubble Gum Kratom Extract! With a sweet and nostalgic flavor, this extract is crafted for ultimate satisfaction. Each 30ml bottle contains 75% concentrated MITRAGYNA.</p>`,
    images: ["https://cdn.shopify.com/s/files/1/0592/7016/8665/files/Twins_BG_30ml_pack.png?v=1758062778"],
    variants: [
      {
        title: "Default",
        sku: "YUM-BG-30ml-TWINS",
        prices: [{ amount: 4800, currency_code: "usd" }],
        manage_inventory: false,
      }
    ],
    tags: ["Kratom", "YUM", "Bubble Gum"],
  },
  {
    title: "333 - YUM Delicious Kratom Extract - Bubble Gum 30ml",
    handle: "yum-delicious-kratom-extract-bubble-gum",
    description: `<p>Irresistible "YUM" Kratom Extract, boasting a delightful bubble gum flavor that's a treat for the senses. Crafted for ultimate satisfaction you can taste. With 75% concentrated MITRAGYNA, each 30ml bottle. Unlock the best tasting Kratom extract for your journey. YUM is perfect for mixing your mocktails for a unique twist.</p>
<ul>
<li>Delightful bubble gum flavor that tantalizes the taste buds.</li>
<li>Each 30ml bottle contains 75% concentrated MITRAGYNA.</li>
<li>Versatile liquid extract perfect for mixing into mocktails for added enjoyment.</li>
<li>3rd Party lab test available by bottle.</li>
</ul>`,
    images: [
      "https://cdn.shopify.com/s/files/1/0592/7016/8665/files/LunaYum-BG-30ml.png?v=1733102421",
      "https://cdn.shopify.com/s/files/1/0592/7016/8665/files/LunaYum-BG-30ml-Lab.png?v=1733102423"
    ],
    variants: [
      {
        title: "Default",
        sku: "YUM-BG-30ml-1",
        prices: [{ amount: 2499, currency_code: "usd" }],
        manage_inventory: false,
        barcode: "857607004814",
        weight: 37,
      }
    ],
    tags: ["Kratom", "YUM", "Bubble Gum"],
  },
  {
    title: "Triple Play - YUM Delicious Kratom Extract - Bubble Gum 30ml",
    handle: "yum-triple-play-kratom-extract-bubble-gum-flavor",
    description: `<p><strong>Triple the Fun: YUM Bubble Gum 30ml Triple Play</strong><br>Get three bottles of our irresistible Bubble Gum Kratom Extract! Perfect for stocking up on your favorite flavor. Each 30ml bottle contains 75% concentrated MITRAGYNA.</p>`,
    images: [
      "https://cdn.shopify.com/s/files/1/0592/7016/8665/files/Triple_BG_30ml_v1.png?v=1758062995",
      "https://cdn.shopify.com/s/files/1/0592/7016/8665/files/Triple_BG_30ml_v2.png?v=1758062995"
    ],
    variants: [
      {
        title: "Default",
        sku: "YUM-BG-30ml-3",
        prices: [{ amount: 7200, currency_code: "usd" }],
        manage_inventory: false,
        weight: 111,
      }
    ],
    tags: ["Kratom", "YUM", "Bubble Gum", "Triple Play"],
  },
  {
    title: "Triple Play - YUM Tropical Breeze 30ml Delicious Kratom Extract",
    handle: "triple-play-yum-tropical-breeze-30ml-delicious-kratom-extract",
    description: `<p><strong>Triple the Refreshment: YUM Tropical Breeze 30ml Triple Play</strong><br>Get three bottles of our refreshing Tropical Breeze Kratom Extract! This vibrant blend captures the essence of your favorite tropical fruits. Each 30ml bottle contains 75% concentrated MITRAGYNA.</p>`,
    images: [
      "https://cdn.shopify.com/s/files/1/0592/7016/8665/files/Triple_TB_30ml_v1.png?v=1758062995",
      "https://cdn.shopify.com/s/files/1/0592/7016/8665/files/Triple_TB_30ml_v2.png?v=1758062996"
    ],
    variants: [
      {
        title: "Default",
        sku: "YUM-TB-30ml-3",
        prices: [{ amount: 7200, currency_code: "usd" }],
        manage_inventory: false,
        weight: 111,
      }
    ],
    tags: ["Kratom", "YUM", "Tropical Breeze", "Triple Play"],
  },
]

// Store settings from Shopify
const storeSettings = {
  name: "YUM",
  email: "sales@yumluna.com",
  phone: "8558055327",
  address: {
    address_1: "204 West Spear Street",
    city: "Carson City",
    province: "Nevada",
    province_code: "NV",
    postal_code: "89703",
    country_code: "US",
  },
  currency: "USD",
  timezone: "America/Los_Angeles",
}

export default async function migrateShopify({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productService = container.resolve(Modules.PRODUCT)
  const regionService = container.resolve(Modules.REGION)
  const storeService = container.resolve(Modules.STORE)

  logger.info("Starting Shopify to Medusa migration...")

  try {
    // 1. Update store settings
    logger.info("Updating store settings...")
    const stores = await storeService.listStores()
    if (stores.length > 0) {
      await storeService.updateStores(stores[0].id, {
        name: storeSettings.name,
        default_currency_code: storeSettings.currency.toLowerCase(),
      })
      logger.info(`Store updated: ${storeSettings.name}`)
    }

    // 2. Ensure USD region exists
    logger.info("Setting up regions...")
    const regions = await regionService.listRegions({ currency_code: "usd" })
    let usdRegion = regions[0]

    if (!usdRegion) {
      const created = await regionService.createRegions({
        name: "United States",
        currency_code: "usd",
        countries: ["us"],
      })
      usdRegion = created
      logger.info("Created USD region for United States")
    } else {
      logger.info(`Using existing region: ${usdRegion.name}`)
    }

    // 3. Create product collection for YUM
    logger.info("Creating product collections...")
    const collections = await productService.listProductCollections({ handle: "yum-kratom" })
    let yumCollection = collections[0]

    if (!yumCollection) {
      const created = await productService.createProductCollections({
        title: "YUM Kratom Extracts",
        handle: "yum-kratom",
      })
      yumCollection = created
      logger.info("Created YUM Kratom collection")
    }

    // 4. Create products
    logger.info(`Importing ${shopifyProducts.length} products...`)

    for (const product of shopifyProducts) {
      // Check if product already exists
      const existing = await productService.listProducts({ handle: product.handle })

      if (existing.length > 0) {
        logger.info(`Product already exists: ${product.title}`)
        continue
      }

      // Create the product
      const createdProduct = await productService.createProducts({
        title: product.title,
        handle: product.handle,
        description: product.description,
        status: "published",
        images: product.images.map((url, i) => ({ url, rank: i })),
        tags: product.tags.map(t => ({ value: t })),
        collection_id: yumCollection?.id,
        options: [
          {
            title: "Size",
            values: ["Default"],
          }
        ],
        variants: product.variants.map(v => ({
          title: v.title,
          sku: v.sku,
          barcode: v.barcode,
          manage_inventory: v.manage_inventory,
          weight: v.weight,
          prices: v.prices,
          options: {
            Size: "Default",
          }
        })),
      })

      logger.info(`Created product: ${product.title}`)
    }

    // 5. Summary
    logger.info("=".repeat(50))
    logger.info("Migration completed successfully!")
    logger.info(`- Store: ${storeSettings.name}`)
    logger.info(`- Products imported: ${shopifyProducts.length}`)
    logger.info(`- Region: United States (USD)`)
    logger.info("=".repeat(50))
    logger.info("")
    logger.info("Next steps:")
    logger.info("1. Configure shipping options in Medusa admin")
    logger.info("2. Set up Stripe payment provider")
    logger.info("3. Configure tax settings")
    logger.info("4. Import customer data (optional)")

  } catch (error) {
    logger.error("Migration failed:", error)
    throw error
  }
}
