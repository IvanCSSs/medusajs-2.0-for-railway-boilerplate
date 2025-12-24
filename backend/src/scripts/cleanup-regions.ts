import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function cleanupRegions({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regionService = container.resolve(Modules.REGION)

  logger.info("Cleaning up default regions...")

  try {
    // List all regions
    const regions = await regionService.listRegions({})
    logger.info(`Found ${regions.length} regions`)

    for (const region of regions) {
      logger.info(`Region: ${region.name} (${region.currency_code}) - ID: ${region.id}`)
    }

    // Delete all non-USD regions (EU defaults)
    const regionsToDelete = regions.filter((r: any) => r.currency_code !== "usd")

    for (const region of regionsToDelete) {
      try {
        await regionService.deleteRegions(region.id)
        logger.info(`Deleted region: ${region.name}`)
      } catch (err: any) {
        logger.error(`Failed to delete ${region.name}: ${err.message}`)
      }
    }

    // List remaining regions
    const remainingRegions = await regionService.listRegions({})
    logger.info("=".repeat(50))
    logger.info("Cleanup completed!")
    logger.info(`Remaining regions: ${remainingRegions.length}`)
    for (const r of remainingRegions) {
      logger.info(`  - ${r.name} (${r.currency_code})`)
    }
    logger.info("=".repeat(50))

  } catch (error: any) {
    logger.error("Cleanup failed:", error.message)
    throw error
  }
}
