import { Module } from "@medusajs/framework/utils"
import EmailTemplateModuleService from "./service"

export const EMAIL_TEMPLATES_MODULE = "emailTemplates"

export type { default as EmailTemplateModuleService } from "./service"

export default Module(EMAIL_TEMPLATES_MODULE, {
  service: EmailTemplateModuleService,
})
