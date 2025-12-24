import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

// US State tax rates from Shopify
const stateTaxRates: Record<string, { rate: number; name: string }> = {
  "AK": { rate: 0, name: "Alaska" },
  "AZ": { rate: 5.6, name: "Arizona" },
  "CA": { rate: 6.0, name: "California" },
  "CO": { rate: 2.9, name: "Colorado" },
  "CT": { rate: 6.35, name: "Connecticut" },
  "DE": { rate: 0, name: "Delaware" },
  "DC": { rate: 5.75, name: "District of Columbia" },
  "FL": { rate: 6.0, name: "Florida" },
  "GA": { rate: 4.0, name: "Georgia" },
  "HI": { rate: 4.0, name: "Hawaii" },
  "ID": { rate: 6.0, name: "Idaho" },
  "IL": { rate: 6.25, name: "Illinois" },
  "IN": { rate: 7.0, name: "Indiana" },
  "IA": { rate: 6.0, name: "Iowa" },
  "KS": { rate: 6.5, name: "Kansas" },
  "KY": { rate: 6.0, name: "Kentucky" },
  "ME": { rate: 5.5, name: "Maine" },
  "MD": { rate: 6.0, name: "Maryland" },
  "MA": { rate: 6.25, name: "Massachusetts" },
  "MI": { rate: 6.0, name: "Michigan" },
  "MN": { rate: 6.875, name: "Minnesota" },
  "MS": { rate: 7.0, name: "Mississippi" },
  "MO": { rate: 4.225, name: "Missouri" },
  "MT": { rate: 0, name: "Montana" },
  "NE": { rate: 5.5, name: "Nebraska" },
  "NV": { rate: 6.85, name: "Nevada" },
  "NH": { rate: 0, name: "New Hampshire" },
  "NJ": { rate: 7.0, name: "New Jersey" },
  "NM": { rate: 5.0, name: "New Mexico" },
  "NY": { rate: 4.0, name: "New York" },
  "NC": { rate: 4.75, name: "North Carolina" },
  "ND": { rate: 5.0, name: "North Dakota" },
  "OH": { rate: 5.75, name: "Ohio" },
  "OK": { rate: 4.5, name: "Oklahoma" },
  "OR": { rate: 0, name: "Oregon" },
  "PA": { rate: 6.0, name: "Pennsylvania" },
  "SC": { rate: 5.0, name: "South Carolina" },
  "SD": { rate: 4.0, name: "South Dakota" },
  "TN": { rate: 7.0, name: "Tennessee" },
  "TX": { rate: 6.25, name: "Texas" },
  "UT": { rate: 4.7, name: "Utah" },
  "VA": { rate: 5.3, name: "Virginia" },
  "WA": { rate: 6.5, name: "Washington" },
  "WY": { rate: 4.0, name: "Wyoming" },
}

export default async function configureStore({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regionService = container.resolve(Modules.REGION)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const taxService = container.resolve(Modules.TAX)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)

  logger.info("Starting store configuration...")

  try {
    // 1. Get the USD region
    logger.info("Finding USD region...")
    const regions = await regionService.listRegions({ currency_code: "usd" })
    const usdRegion = regions[0]

    if (!usdRegion) {
      throw new Error("USD region not found. Run migrate-shopify.ts first.")
    }
    logger.info(`Found region: ${usdRegion.name} (${usdRegion.id})`)

    // 2. Create stock location for fulfillment
    logger.info("Setting up stock location...")
    const stockLocations = await stockLocationService.listStockLocations({ name: "YUM Warehouse" })
    let warehouse = stockLocations[0]

    if (!warehouse) {
      warehouse = await stockLocationService.createStockLocations({
        name: "YUM Warehouse",
        address: {
          address_1: "204 West Spear Street",
          city: "Carson City",
          province: "NV",
          postal_code: "89703",
          country_code: "us",
        },
      } as any)
      logger.info("Created YUM Warehouse stock location")
    } else {
      logger.info("YUM Warehouse already exists")
    }

    // 3. Set up fulfillment provider and shipping options
    logger.info("Setting up fulfillment...")

    // Check for existing fulfillment sets
    const fulfillmentSets = await fulfillmentService.listFulfillmentSets({})
    let shippingFulfillmentSet = fulfillmentSets.find((fs: any) => fs.name === "Shipping")

    if (!shippingFulfillmentSet) {
      // Create fulfillment set for shipping
      shippingFulfillmentSet = await fulfillmentService.createFulfillmentSets({
        name: "Shipping",
        type: "shipping",
      } as any)
      logger.info("Created Shipping fulfillment set")
    }

    // Check for existing service zones
    const serviceZones = await fulfillmentService.listServiceZones({})
    let usZone = serviceZones.find((sz: any) => sz.name === "United States")

    if (!usZone) {
      // Create service zone for US
      usZone = await fulfillmentService.createServiceZones({
        name: "United States",
        fulfillment_set_id: shippingFulfillmentSet.id,
        geo_zones: [{
          type: "country",
          country_code: "us",
        }],
      } as any)
      logger.info("Created United States service zone")
    }

    // Check for existing shipping options
    const shippingOptions = await fulfillmentService.listShippingOptions({})
    const hasExpressShipping = shippingOptions.some((so: any) => so.name === "Free Express Shipping")

    if (!hasExpressShipping) {
      // Get fulfillment providers
      const providers = await fulfillmentService.listFulfillmentProviders({})
      const manualProvider = providers.find((p: any) => p.id.includes("manual"))

      if (manualProvider) {
        // Create free express shipping option (matching Shopify's "Express" at $0.00)
        await fulfillmentService.createShippingOptions({
          name: "Free Express Shipping",
          service_zone_id: usZone.id,
          shipping_profile_id: null, // Will use default
          provider_id: manualProvider.id,
          price_type: "flat",
          type: {
            label: "Express",
            description: "Free express shipping on all orders",
            code: "express",
          },
          data: {},
          rules: [],
        } as any)
        logger.info("Created Free Express Shipping option")
      } else {
        logger.warn("No manual fulfillment provider found. Please configure shipping in admin.")
      }
    } else {
      logger.info("Free Express Shipping already exists")
    }

    // 4. Set up tax configuration
    logger.info("Setting up tax rates...")

    // Get existing tax regions
    const taxRegions = await taxService.listTaxRegions({})
    const hasUSTaxRegion = taxRegions.some((tr: any) => tr.country_code === "us")

    if (!hasUSTaxRegion) {
      // Create US tax region
      const usTaxRegion = await taxService.createTaxRegions({
        country_code: "us",
      } as any)
      logger.info("Created US tax region")

      // Create tax rates for each state with non-zero rates
      let taxRatesCreated = 0
      for (const [stateCode, { rate, name }] of Object.entries(stateTaxRates)) {
        if (rate > 0) {
          await taxService.createTaxRates({
            tax_region_id: usTaxRegion.id,
            name: `${name} State Tax`,
            code: `${stateCode}-STATE`,
            rate: rate,
            is_default: false,
            metadata: {
              province_code: stateCode,
            },
          } as any)
          taxRatesCreated++
        }
      }
      logger.info(`Created ${taxRatesCreated} state tax rates`)
    } else {
      logger.info("US tax region already exists")
    }

    // 5. Summary
    logger.info("=".repeat(50))
    logger.info("Store configuration completed!")
    logger.info("=".repeat(50))
    logger.info("")
    logger.info("Configured:")
    logger.info("- Stock location: YUM Warehouse (Carson City, NV)")
    logger.info("- Shipping: Free Express Shipping (US)")
    logger.info("- Tax rates: State-specific rates for all US states")
    logger.info("")
    logger.info("Remaining manual steps:")
    logger.info("1. Link shipping options to sales channels in admin")
    logger.info("2. Configure Authorize.net payment provider")
    logger.info("3. Review and adjust tax settings if needed")

  } catch (error) {
    logger.error("Configuration failed:", error)
    throw error
  }
}
