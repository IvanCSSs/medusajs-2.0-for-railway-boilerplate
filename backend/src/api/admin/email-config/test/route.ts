import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { INotificationModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { EmailTemplates } from "../../../../modules/email-notifications/templates"

interface TestEmailBody {
  template: string
  email: string
}

export async function POST(req: MedusaRequest<TestEmailBody>, res: MedusaResponse) {
  const { template, email } = req.body

  if (!template || !email) {
    return res.status(400).json({ message: "Template and email are required" })
  }

  const notificationService: INotificationModuleService = req.scope.resolve(Modules.NOTIFICATION)

  // Build test data based on template
  let templateData: Record<string, any> = {}

  switch (template) {
    case "invite-user":
      templateData = {
        emailOptions: {
          subject: "[TEST] You've been invited to Medusa!",
        },
        inviteLink: `${process.env.BACKEND_PUBLIC_URL || "https://example.com"}/app/invite?token=test-token-123`,
        preview: "This is a test invitation email",
      }
      break

    case "password-reset":
      templateData = {
        emailOptions: {
          subject: "[TEST] Reset Your Password",
        },
        resetLink: `${process.env.BACKEND_PUBLIC_URL || "https://example.com"}/app/reset-password?token=test-token-123`,
        preview: "This is a test password reset email",
      }
      break

    case "order-placed":
      templateData = {
        emailOptions: {
          subject: "[TEST] Order Confirmation",
        },
        order: {
          id: "order_test123",
          display_id: 12345,
          total: 4999,
          currency_code: "usd",
          items: [
            {
              title: "Test Product",
              quantity: 2,
              unit_price: 2499,
            },
          ],
          shipping_address: {
            first_name: "Test",
            last_name: "Customer",
            address_1: "123 Test Street",
            city: "Test City",
            province: "TS",
            postal_code: "12345",
            country_code: "US",
          },
        },
        preview: "This is a test order confirmation email",
      }
      break

    default:
      return res.status(400).json({ message: `Unknown template: ${template}` })
  }

  try {
    await notificationService.createNotifications({
      to: email,
      channel: "email",
      template: (EmailTemplates as Record<string, string>)[template.toUpperCase().replace(/-/g, "_")] || template,
      data: templateData,
    })

    return res.json({ success: true, message: `Test email sent to ${email}` })
  } catch (error: any) {
    console.error("Failed to send test email:", error)
    return res.status(500).json({ message: error.message || "Failed to send test email" })
  }
}
