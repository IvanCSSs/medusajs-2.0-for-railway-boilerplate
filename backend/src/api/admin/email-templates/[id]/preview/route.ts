import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { EMAIL_TEMPLATES_MODULE, EmailTemplateService } from "../../../../../modules/email-templates"

// POST /admin/email-templates/:id/preview - Preview a template with sample data
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const emailTemplateService = req.scope.resolve<EmailTemplateService>(EMAIL_TEMPLATES_MODULE)
  const { id } = req.params
  const { variables } = req.body as { variables?: Record<string, any> }

  try {
    const result = await emailTemplateService.renderTemplate(id, variables || getSampleData())
    return res.json(result)
  } catch (error: any) {
    return res.status(400).json({ message: error.message })
  }
}

// Sample data for previewing templates
function getSampleData() {
  return {
    customer: {
      first_name: "John",
      last_name: "Doe",
      email: "john.doe@example.com",
    },
    order: {
      id: "order_test123",
      display_id: 12345,
      total: 4999,
      subtotal: 4499,
      shipping_total: 500,
      tax_total: 0,
      currency_code: "USD",
      created_at: new Date().toISOString(),
      items: [
        {
          title: "YUM Delicious Kratom Extract - Bubble Gum 30ml",
          quantity: 2,
          unit_price: 2499,
          thumbnail: "",
        },
      ],
      shipping_address: {
        first_name: "John",
        last_name: "Doe",
        address_1: "123 Main Street",
        address_2: "Apt 4B",
        city: "Carson City",
        province: "NV",
        postal_code: "89703",
        country_code: "US",
      },
    },
    store: {
      name: "YUM Kratom",
      url: "https://yumkratom.com",
    },
    reset_link: "https://example.com/reset-password?token=abc123",
    invite_link: "https://example.com/invite?token=abc123",
    tracking: {
      number: "1Z999AA10123456784",
      url: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
      carrier: "UPS",
    },
  }
}
