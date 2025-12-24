import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { EMAIL_TEMPLATES_MODULE } from "../../../modules/email-templates"

// GET /admin/email-templates - List all templates
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const emailTemplateService = req.scope.resolve(EMAIL_TEMPLATES_MODULE)

  const templates = await emailTemplateService.listEmailTemplates({})

  return res.json({ templates })
}

// POST /admin/email-templates - Create a new template
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const emailTemplateService = req.scope.resolve(EMAIL_TEMPLATES_MODULE)

  const { name, subject, description, event_name, html_content, is_active, variables } = req.body as any

  if (!name || !subject || !event_name || !html_content) {
    return res.status(400).json({
      message: "name, subject, event_name, and html_content are required",
    })
  }

  const template = await emailTemplateService.createEmailTemplates({
    name,
    subject,
    description: description || null,
    event_name,
    html_content,
    is_active: is_active ?? true,
    variables: variables || [],
  })

  return res.status(201).json({ template })
}
