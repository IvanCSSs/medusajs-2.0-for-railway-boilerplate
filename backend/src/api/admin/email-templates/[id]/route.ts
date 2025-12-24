import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { EMAIL_TEMPLATES_MODULE } from "../../../../modules/email-templates"

// GET /admin/email-templates/:id - Get a single template
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const emailTemplateService = req.scope.resolve(EMAIL_TEMPLATES_MODULE)
  const { id } = req.params

  try {
    const template = await emailTemplateService.retrieveEmailTemplate(id)
    return res.json({ template })
  } catch (error) {
    return res.status(404).json({ message: "Template not found" })
  }
}

// PUT /admin/email-templates/:id - Update a template
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const emailTemplateService = req.scope.resolve(EMAIL_TEMPLATES_MODULE)
  const { id } = req.params
  const { name, subject, description, event_name, html_content, is_active, variables } = req.body as any

  try {
    const template = await emailTemplateService.updateEmailTemplates(id, {
      ...(name && { name }),
      ...(subject && { subject }),
      ...(description !== undefined && { description }),
      ...(event_name && { event_name }),
      ...(html_content && { html_content }),
      ...(is_active !== undefined && { is_active }),
      ...(variables && { variables }),
      updated_at: new Date(),
    })

    return res.json({ template })
  } catch (error) {
    return res.status(404).json({ message: "Template not found" })
  }
}

// DELETE /admin/email-templates/:id - Delete a template
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const emailTemplateService = req.scope.resolve(EMAIL_TEMPLATES_MODULE)
  const { id } = req.params

  try {
    await emailTemplateService.deleteEmailTemplates(id)
    return res.json({ success: true })
  } catch (error) {
    return res.status(404).json({ message: "Template not found" })
  }
}
