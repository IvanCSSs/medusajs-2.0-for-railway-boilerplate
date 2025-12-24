import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function fixShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
  const remoteLink = container.resolve(ContainerRegistrationKeys.REMOTE_LINK)

  logger.info("Diagnosing and fixing shipping setup...")

  try {
    // 1. Check stock locations
    logger.info("\n=== Stock Locations ===")
    const stockLocations = await stockLocationService.listStockLocations({})
    for (const loc of stockLocations) {
      logger.info(`Location: ${loc.name} (${loc.id})`)
    }

    // 2. Check fulfillment sets
    logger.info("\n=== Fulfillment Sets ===")
    const fulfillmentSets = await fulfillmentService.listFulfillmentSets({})
    logger.info(`Found ${fulfillmentSets.length} fulfillment sets`)
    for (const fs of fulfillmentSets) {
      logger.info(`  - ${fs.name} (${fs.type}) ID: ${fs.id}`)
    }

    // 3. Check service zones
    logger.info("\n=== Service Zones ===")
    const serviceZones = await fulfillmentService.listServiceZones({})
    logger.info(`Found ${serviceZones.length} service zones`)
    for (const sz of serviceZones) {
      logger.info(`  - ${sz.name} ID: ${sz.id}`)
    }

    // 4. Check shipping options
    logger.info("\n=== Shipping Options ===")
    const shippingOptions = await fulfillmentService.listShippingOptions({})
    logger.info(`Found ${shippingOptions.length} shipping options`)
    for (const so of shippingOptions) {
      logger.info(`  - ${so.name} ID: ${so.id}`)
    }

    // 5. Check fulfillment providers
    logger.info("\n=== Fulfillment Providers ===")
    const providers = await fulfillmentService.listFulfillmentProviders({})
    logger.info(`Found ${providers.length} providers`)
    for (const p of providers) {
      logger.info(`  - ${p.id}`)
    }

    // 6. Get the warehouse location
    let warehouse = stockLocations.find((l: any) => l.name === "YUM Warehouse")
    if (!warehouse && stockLocations.length > 0) {
      warehouse = stockLocations[0]
    }

    if (!warehouse) {
      // Create warehouse if missing
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
      logger.info("Created YUM Warehouse")
    }

    // 7. Create or get fulfillment set linked to location
    let fulfillmentSet = fulfillmentSets.find((fs: any) => fs.type === "shipping")

    if (!fulfillmentSet) {
      const created = await fulfillmentService.createFulfillmentSets({
        name: "Default Shipping",
        type: "shipping",
      } as any)
      fulfillmentSet = Array.isArray(created) ? created[0] : created
      logger.info(`Created fulfillment set: ${fulfillmentSet.id}`)
    }

    // 8. Link fulfillment set to stock location
    try {
      await remoteLink.create({
        [Modules.STOCK_LOCATION]: {
          stock_location_id: warehouse.id,
        },
        [Modules.FULFILLMENT]: {
          fulfillment_set_id: fulfillmentSet.id,
        },
      })
      logger.info(`Linked fulfillment set to warehouse`)
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        logger.info("Link already exists")
      } else {
        logger.warn(`Link error (may already exist): ${err.message}`)
      }
    }

    // 9. Create or get service zone
    let serviceZone = serviceZones.find((sz: any) => sz.name === "United States")

    if (!serviceZone) {
      const created = await fulfillmentService.createServiceZones({
        name: "United States",
        fulfillment_set_id: fulfillmentSet.id,
        geo_zones: [{
          type: "country",
          country_code: "us",
        }],
      } as any)
      serviceZone = Array.isArray(created) ? created[0] : created
      logger.info(`Created service zone: ${serviceZone.id}`)
    }

    // 10. Create shipping option if none exist
    if (shippingOptions.length === 0) {
      const manualProvider = providers.find((p: any) => p.id.includes("manual"))

      if (manualProvider) {
        await fulfillmentService.createShippingOptions({
          name: "Free Shipping",
          service_zone_id: serviceZone.id,
          provider_id: manualProvider.id,
          price_type: "flat",
          type: {
            label: "Standard",
            description: "Free shipping on all US orders",
            code: "standard",
          },
          data: {},
          rules: [],
        } as any)
        logger.info("Created Free Shipping option")
      }
    }

    logger.info("\n" + "=".repeat(50))
    logger.info("Shipping setup complete!")
    logger.info("Go to Settings → Locations in admin to see the warehouse")
    logger.info("The fulfillment set should now be linked to YUM Warehouse")
    logger.info("=".repeat(50))

  } catch (error: any) {
    logger.error("Error:", error.message)
    throw error
  }
}
