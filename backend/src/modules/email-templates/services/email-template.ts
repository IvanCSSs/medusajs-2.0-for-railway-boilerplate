import { MedusaService } from "@medusajs/framework/utils"
import { EmailTemplate } from "../models/email-template"

class EmailTemplateService extends MedusaService({
  EmailTemplate,
}) {
  /**
   * Render a template by replacing variables with actual values
   */
  async renderTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Promise<{ subject: string; html: string }> {
    const template = await this.retrieveEmailTemplate(templateId)

    let subject = template.subject
    let html = template.html_content

    // Replace variables in subject and html
    // Variables are in format {{variable.path}}
    const replaceVariables = (text: string, vars: Record<string, any>): string => {
      return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const keys = path.trim().split(".")
        let value: any = vars
        for (const key of keys) {
          if (value && typeof value === "object" && key in value) {
            value = value[key]
          } else {
            return match // Keep original if path not found
          }
        }
        return value !== undefined ? String(value) : match
      })
    }

    subject = replaceVariables(subject, variables)
    html = replaceVariables(html, variables)

    return { subject, html }
  }

  /**
   * Find template by event name
   */
  async findByEvent(eventName: string) {
    const templates = await this.listEmailTemplates({
      event_name: eventName,
      is_active: true,
    })
    return templates[0] || null
  }
}

export default EmailTemplateService
