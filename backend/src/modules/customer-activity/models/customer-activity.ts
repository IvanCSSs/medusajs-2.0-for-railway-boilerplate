import { model } from "@medusajs/framework/utils"

export const CustomerActivity = model.define("customer_activity", {
  id: model.id().primaryKey(),
  customer_id: model.text().index(),
  event_type: model.text().index(), // order.placed, cart.created, customer.created, email.sent, checkout.started, etc.
  event_name: model.text(), // Human readable: "Placed order #1082", "Started checkout", etc.
  description: model.text().nullable(), // Additional details
  metadata: model.json().nullable(), // Store order_id, cart_id, email_type, etc.
  created_at: model.dateTime().default(() => new Date()),
})
