import { MedusaService } from "@medusajs/framework/utils"
import { CustomerActivity } from "./models/customer-activity"

class CustomerActivityModuleService extends MedusaService({
  CustomerActivity,
}) {
  /**
   * Log a customer activity event
   */
  async logActivity(data: {
    customer_id: string
    event_type: string
    event_name: string
    description?: string
    metadata?: Record<string, any>
  }) {
    return await this.createCustomerActivities(data)
  }

  /**
   * Get all activities for a customer, sorted by most recent
   */
  async getCustomerTimeline(customer_id: string, limit: number = 50) {
    const activities = await this.listCustomerActivities(
      { customer_id },
      {
        order: { created_at: "DESC" },
        take: limit,
      }
    )
    return activities
  }
}

export default CustomerActivityModuleService
