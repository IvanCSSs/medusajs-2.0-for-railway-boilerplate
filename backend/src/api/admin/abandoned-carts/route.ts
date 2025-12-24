import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    // Get hours threshold from query param, default to 24 hours
    const hoursThreshold = parseInt(req.query.hours as string) || 24

    // Calculate the cutoff date
    const cutoffDate = new Date()
    cutoffDate.setHours(cutoffDate.getHours() - hoursThreshold)

    // Get the query builder from container
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // Fetch carts that have email but no completed_at (abandoned)
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        "created_at",
        "updated_at",
        "completed_at",
        "currency_code",
        "total",
        "items.*",
        "shipping_address.*",
      ],
      filters: {
        email: { $ne: null },
        completed_at: null,
        updated_at: { $gte: cutoffDate.toISOString() },
      },
    })

    // Filter out carts with empty items and sort by updated_at descending
    const abandonedCarts = carts
      .filter((cart: any) => cart.items && cart.items.length > 0)
      .sort((a: any, b: any) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )

    res.json({
      carts: abandonedCarts,
      count: abandonedCarts.length,
      hours_threshold: hoursThreshold,
    })
  } catch (error) {
    console.error("Error fetching abandoned carts:", error)
    res.status(500).json({
      error: "Failed to fetch abandoned carts",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
