import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowLeft, Eye } from "@medusajs/icons"
import { Container, Heading, Text, Button, Input, Label, Switch, toast, Toaster, Textarea } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

const defaultHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .content { color: #333; line-height: 1.6; }
    .button { display: inline-block; background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>YUM Kratom</h1>
    </div>
    <div class="content">
      <p>Hello {{customer.first_name}},</p>
      <p>Your email content goes here...</p>
    </div>
    <div class="footer">
      <p>&copy; YUM Kratom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`

const EditTemplatePage = () => {
  const { id } = useParams<{ id: string }>()
  const isNew = id === "new"
  const navigate = useNavigate()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")

  const [form, setForm] = useState({
    name: "",
    subject: "",
    description: "",
    event_name: "",
    html_content: defaultHtml,
    is_active: true,
  })

  useEffect(() => {
    if (!isNew && id) {
      fetchTemplate()
    }
  }, [id])

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/admin/email-templates/${id}`, {
        credentials: "include",
      })
      if (!response.ok) throw new Error("Template not found")
      const data = await response.json()
      setForm({
        name: data.template.name || "",
        subject: data.template.subject || "",
        description: data.template.description || "",
        event_name: data.template.event_name || "",
        html_content: data.template.html_content || defaultHtml,
        is_active: data.template.is_active ?? true,
      })
    } catch (err) {
      toast.error("Failed to load template")
      navigate("/email-templates")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!form.name || !form.subject || !form.event_name || !form.html_content) {
      toast.error("Please fill in all required fields")
      return
    }

    setSaving(true)
    try {
      const url = isNew ? "/admin/email-templates" : `/admin/email-templates/${id}`
      const method = isNew ? "POST" : "PUT"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to save")
      }

      toast.success(isNew ? "Template created!" : "Template saved!")
      navigate("/email-templates")
    } catch (err: any) {
      toast.error(err.message || "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async () => {
    if (!id && !isNew) return

    try {
      // For new templates, we'll render locally
      if (isNew) {
        setPreviewHtml(form.html_content)
        setShowPreview(true)
        return
      }

      const response = await fetch(`/admin/email-templates/${id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      })

      if (!response.ok) throw new Error("Failed to generate preview")

      const data = await response.json()
      setPreviewHtml(data.html)
      setShowPreview(true)
    } catch (err) {
      toast.error("Failed to generate preview")
    }
  }

  if (loading) {
    return (
      <Container className="p-6">
        <Text>Loading...</Text>
      </Container>
    )
  }

  return (
    <>
      <Toaster />
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="secondary" size="small" onClick={() => navigate("/email-templates")}>
              <ArrowLeft />
            </Button>
            <div>
              <Heading level="h1">{isNew ? "Create Template" : "Edit Template"}</Heading>
              <Text className="text-ui-fg-subtle">
                {isNew ? "Create a new email template" : `Editing: ${form.name}`}
              </Text>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handlePreview}>
              <Eye />
              Preview
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 px-6 py-4">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Order Confirmation"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="event">Trigger Event *</Label>
              <select
                id="event"
                className="w-full rounded-md border border-ui-border-base px-3 py-2 text-sm"
                value={form.event_name}
                onChange={(e) => setForm({ ...form, event_name: e.target.value })}
              >
                <option value="">Select an event...</option>
                <optgroup label="Authentication">
                  <option value="invite.created">invite.created</option>
                  <option value="invite.resent">invite.resent</option>
                  <option value="auth.password_reset">auth.password_reset</option>
                </optgroup>
                <optgroup label="Orders">
                  <option value="order.placed">order.placed</option>
                  <option value="order.canceled">order.canceled</option>
                  <option value="order.shipment_created">order.shipment_created</option>
                </optgroup>
                <optgroup label="Customers">
                  <option value="customer.created">customer.created</option>
                  <option value="customer.password_reset">customer.password_reset</option>
                </optgroup>
                <optgroup label="Fulfillment">
                  <option value="fulfillment.created">fulfillment.created</option>
                  <option value="fulfillment.shipment_created">fulfillment.shipment_created</option>
                </optgroup>
              </select>
            </div>

            <div>
              <Label htmlFor="subject">Email Subject *</Label>
              <Input
                id="subject"
                placeholder="e.g., Your order has been confirmed!"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
              <Text className="text-ui-fg-subtle text-xs mt-1">
                You can use variables: {"{{customer.first_name}}"}, {"{{order.display_id}}"}
              </Text>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Internal description for this template"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            {/* Variables Reference */}
            <div className="rounded-lg border border-ui-border-base p-4 mt-4">
              <Text className="font-medium mb-2">Available Variables</Text>
              <div className="text-xs text-ui-fg-subtle space-y-1">
                <p><code>{"{{customer.first_name}}"}</code> - Customer first name</p>
                <p><code>{"{{customer.last_name}}"}</code> - Customer last name</p>
                <p><code>{"{{customer.email}}"}</code> - Customer email</p>
                <p><code>{"{{order.display_id}}"}</code> - Order number</p>
                <p><code>{"{{order.total}}"}</code> - Order total (cents)</p>
                <p><code>{"{{reset_link}}"}</code> - Password reset link</p>
                <p><code>{"{{invite_link}}"}</code> - Invitation link</p>
                <p><code>{"{{tracking.number}}"}</code> - Tracking number</p>
                <p><code>{"{{tracking.url}}"}</code> - Tracking URL</p>
              </div>
            </div>
          </div>

          {/* HTML Editor */}
          <div className="space-y-2">
            <Label>HTML Content *</Label>
            <Textarea
              className="font-mono text-sm h-[500px]"
              value={form.html_content}
              onChange={(e) => setForm({ ...form, html_content: e.target.value })}
              placeholder="Enter HTML content..."
            />
          </div>
        </div>
      </Container>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[800px] max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <Text className="font-medium">Email Preview</Text>
              <Button variant="secondary" size="small" onClick={() => setShowPreview(false)}>
                Close
              </Button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-60px)]">
              <iframe
                srcDoc={previewHtml || form.html_content}
                className="w-full h-[600px] border rounded"
                title="Email Preview"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default EditTemplatePage
