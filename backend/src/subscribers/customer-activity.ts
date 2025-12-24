import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService, ICustomerModuleService, ICartModuleService } from "@medusajs/framework/types"
import { CUSTOMER_ACTIVITY_MODULE } from "../modules/customer-activity"
import CustomerActivityModuleService from "../modules/customer-activity/service"

// Event type mappings for human-readable names
const EVENT_NAMES: Record<string, (data: any) => { name: string; description?: string }> = {
  "order.placed": (data) => ({
    name: `Placed order #${data.display_id || data.id?.slice(-8)}`,
    description: `Order total: ${data.total ? (data.total / 100).toFixed(2) : "N/A"}`,
  }),
  "order.canceled": (data) => ({
    name: `Order #${data.display_id || data.id?.slice(-8)} was canceled`,
  }),
  "order.completed": (data) => ({
    name: `Order #${data.display_id || data.id?.slice(-8)} completed`,
  }),
  "customer.created": () => ({
    name: "Customer account created",
    description: "Welcome to the store!",
  }),
  "customer.updated": () => ({
    name: "Updated account information",
  }),
  "cart.created": () => ({
    name: "Started shopping session",
  }),
  "cart.updated": (data) => ({
    name: "Updated cart",
    description: data.items?.length ? `${data.items.length} item(s) in cart` : undefined,
  }),
  "fulfillment.created": (data) => ({
    name: "Order fulfillment started",
    description: `Shipment created for order`,
  }),
  "fulfillment.shipment_created": () => ({
    name: "Order shipped",
    description: "Tracking information available",
  }),
  "return.created": () => ({
    name: "Return request created",
  }),
  "claim.created": () => ({
    name: "Claim submitted",
  }),
  "notification.sent": (data) => ({
    name: `Email sent: ${data.template || data.channel || "notification"}`,
    description: data.to ? `Sent to ${data.to}` : undefined,
  }),
}

/**
 * Main handler for customer activity events
 */
async function logCustomerActivity(
  container: any,
  event_type: string,
  customer_id: string | null,
  data: any
) {
  if (!customer_id) return

  try {
    const activityService: CustomerActivityModuleService = container.resolve(CUSTOMER_ACTIVITY_MODULE)

    const eventConfig = EVENT_NAMES[event_type]
    const { name, description } = eventConfig
      ? eventConfig(data)
      : { name: event_type.replace(/\./g, " ").replace(/^\w/, (c) => c.toUpperCase()), description: undefined }

    await activityService.logActivity({
      customer_id,
      event_type,
      event_name: name,
      description,
      metadata: {
        event_data_id: data.id,
        ...data,
      },
    })
  } catch (error) {
    console.error(`[CustomerActivity] Failed to log ${event_type}:`, error)
  }
}

// Order events
export async function orderPlacedActivity({ event: { data }, container }: SubscriberArgs<any>) {
  const orderService: IOrderModuleService = container.resolve(Modules.ORDER)
  const order = await orderService.retrieveOrder(data.id)
  await logCustomerActivity(container, "order.placed", order.customer_id, {
    ...data,
    display_id: order.display_id,
    total: order.total,
  })
}

export async function orderCanceledActivity({ event: { data }, container }: SubscriberArgs<any>) {
  const orderService: IOrderModuleService = container.resolve(Modules.ORDER)
  const order = await orderService.retrieveOrder(data.id)
  await logCustomerActivity(container, "order.canceled", order.customer_id, {
    ...data,
    display_id: order.display_id,
  })
}

// Customer events
export async function customerCreatedActivity({ event: { data }, container }: SubscriberArgs<any>) {
  await logCustomerActivity(container, "customer.created", data.id, data)
}

export async function customerUpdatedActivity({ event: { data }, container }: SubscriberArgs<any>) {
  await logCustomerActivity(container, "customer.updated", data.id, data)
}

// Cart events - try to get customer from cart
export async function cartCreatedActivity({ event: { data }, container }: SubscriberArgs<any>) {
  if (data.customer_id) {
    await logCustomerActivity(container, "cart.created", data.customer_id, data)
  }
}

export async function cartUpdatedActivity({ event: { data }, container }: SubscriberArgs<any>) {
  if (data.customer_id) {
    await logCustomerActivity(container, "cart.updated", data.customer_id, data)
  }
}

// Fulfillment events
export async function fulfillmentCreatedActivity({ event: { data }, container }: SubscriberArgs<any>) {
  if (data.order_id) {
    const orderService: IOrderModuleService = container.resolve(Modules.ORDER)
    const order = await orderService.retrieveOrder(data.order_id)
    if (order.customer_id) {
      await logCustomerActivity(container, "fulfillment.created", order.customer_id, data)
    }
  }
}

// Export subscriber configs
export const config: SubscriberConfig = {
  event: [
    "order.placed",
    "order.canceled",
    "customer.created",
    "customer.updated",
    "cart.created",
    "cart.updated",
    "fulfillment.created",
  ],
}

export default async function customerActivityHandler({ event, container }: SubscriberArgs<any>) {
  const { name, data } = event

  switch (name) {
    case "order.placed":
      await orderPlacedActivity({ event: { data }, container } as any)
      break
    case "order.canceled":
      await orderCanceledActivity({ event: { data }, container } as any)
      break
    case "customer.created":
      await customerCreatedActivity({ event: { data }, container } as any)
      break
    case "customer.updated":
      await customerUpdatedActivity({ event: { data }, container } as any)
      break
    case "cart.created":
      await cartCreatedActivity({ event: { data }, container } as any)
      break
    case "cart.updated":
      await cartUpdatedActivity({ event: { data }, container } as any)
      break
    case "fulfillment.created":
      await fulfillmentCreatedActivity({ event: { data }, container } as any)
      break
  }
}
