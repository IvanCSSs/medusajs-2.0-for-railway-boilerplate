import { Module } from "@medusajs/framework/utils"
import EmailTemplateService from "./services/email-template"

export const EMAIL_TEMPLATES_MODULE = "emailTemplates"

export type { default as EmailTemplateService } from "./services/email-template"

export default Module(EMAIL_TEMPLATES_MODULE, {
  service: EmailTemplateService,
})
