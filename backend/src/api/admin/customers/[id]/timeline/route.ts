import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CUSTOMER_ACTIVITY_MODULE } from "../../../../../modules/customer-activity"
import CustomerActivityModuleService from "../../../../../modules/customer-activity/service"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id } = req.params
    const limit = parseInt(req.query.limit as string) || 50

    const activityService: CustomerActivityModuleService = req.scope.resolve(
      CUSTOMER_ACTIVITY_MODULE
    )

    const activities = await activityService.getCustomerTimeline(id, limit)

    // Group activities by date for better display
    const groupedByDate: Record<string, any[]> = {}

    for (const activity of activities) {
      const date = new Date(activity.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      if (!groupedByDate[date]) {
        groupedByDate[date] = []
      }

      groupedByDate[date].push({
        ...activity,
        time: new Date(activity.created_at).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      })
    }

    res.json({
      activities,
      grouped: groupedByDate,
      count: activities.length,
    })
  } catch (error) {
    console.error("Error fetching customer timeline:", error)
    res.status(500).json({
      error: "Failed to fetch customer timeline",
      message: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
