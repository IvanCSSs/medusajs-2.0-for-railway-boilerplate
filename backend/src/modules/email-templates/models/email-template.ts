import { model } from "@medusajs/framework/utils"

export const EmailTemplate = model.define("email_template", {
  id: model.id().primaryKey(),
  name: model.text(),
  subject: model.text(),
  description: model.text().nullable(),
  event_name: model.text(),
  html_content: model.text(),
  is_active: model.boolean().default(true),
  variables: model.json().default([]),
  created_at: model.dateTime().default(() => new Date()),
  updated_at: model.dateTime().default(() => new Date()),
})
