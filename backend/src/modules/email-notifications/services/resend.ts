import { Logger, NotificationTypes } from '@medusajs/framework/types'
import { AbstractNotificationProviderService, MedusaError } from '@medusajs/framework/utils'
import { Resend, CreateEmailOptions } from 'resend'
import { ReactNode } from 'react'
import { generateEmailTemplate } from '../templates'

type InjectedDependencies = {
  logger: Logger
  // Note: emailTemplates may be injected if email-templates module is available
}

interface ResendServiceConfig {
  apiKey: string
  from: string
}

export interface ResendNotificationServiceOptions {
  api_key: string
  from: string
}

type NotificationEmailOptions = Omit<
  CreateEmailOptions,
  'to' | 'from' | 'react' | 'html' | 'attachments'
>

/**
 * Service to handle email notifications using the Resend API.
 */
export class ResendNotificationService extends AbstractNotificationProviderService {
  static identifier = "RESEND_NOTIFICATION_SERVICE"
  protected config_: ResendServiceConfig // Configuration for Resend API
  protected logger_: Logger // Logger for error and event logging
  protected resend: Resend // Instance of the Resend API client
  protected emailTemplatesService_?: any // Database templates service

  constructor(container: InjectedDependencies & Record<string, any>, options: ResendNotificationServiceOptions) {
    super()
    this.config_ = {
      apiKey: options.api_key,
      from: options.from
    }
    this.logger_ = container.logger
    this.resend = new Resend(this.config_.apiKey)
    // emailTemplates is optional - only available if email-templates module is loaded
    // Access it safely without requiring it in the type to avoid Awilix resolution errors
    try {
      this.emailTemplatesService_ = (container as any).emailTemplates
    } catch {
      this.emailTemplatesService_ = undefined
    }
  }

  /**
   * Render variables in a template string
   */
  private renderVariables(text: string, vars: Record<string, any>): string {
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

  /**
   * Try to get template from database first
   */
  private async getDbTemplate(_templateName: string, eventName?: string): Promise<{ subject: string; html: string } | null> {
    if (!this.emailTemplatesService_) return null

    try {
      // Try to find by event name first
      if (eventName) {
        const templates = await this.emailTemplatesService_.listEmailTemplates({
          event_name: eventName,
          is_active: true,
        })
        if (templates.length > 0) {
          return {
            subject: templates[0].subject,
            html: templates[0].html_content,
          }
        }
      }
      return null
    } catch (error) {
      this.logger_.warn(`Failed to fetch DB template: ${error}`)
      return null
    }
  }

  async send(
    notification: NotificationTypes.ProviderSendNotificationDTO
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    if (!notification) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `No notification information provided`)
    }
    if (notification.channel === 'sms') {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `SMS notification not supported`)
    }

    const emailOptions = (notification.data?.emailOptions || {}) as NotificationEmailOptions
    let message: CreateEmailOptions

    // First, check if there's a database template for this event
    const eventName = notification.data?.event_name as string | undefined
    const dbTemplate = await this.getDbTemplate(notification.template, eventName)

    if (dbTemplate) {
      // Use database template with variable substitution
      const variables = notification.data || {}
      const renderedSubject = this.renderVariables(dbTemplate.subject, variables)
      const renderedHtml = this.renderVariables(dbTemplate.html, variables)

      message = {
        to: notification.to,
        from: notification.from?.trim() ?? this.config_.from,
        html: renderedHtml,
        subject: renderedSubject,
        headers: emailOptions.headers,
        replyTo: emailOptions.replyTo,
        cc: emailOptions.cc,
        bcc: emailOptions.bcc,
        tags: emailOptions.tags,
        text: emailOptions.text,
        attachments: Array.isArray(notification.attachments)
          ? notification.attachments.map((attachment) => ({
              content: attachment.content,
              filename: attachment.filename,
              content_type: attachment.content_type,
              disposition: attachment.disposition ?? 'attachment',
              id: attachment.id ?? undefined
            }))
          : undefined,
        scheduledAt: emailOptions.scheduledAt
      }

      this.logger_.log(`Using database template for "${eventName || notification.template}"`)
    } else {
      // Fall back to code-based templates
      let emailContent: ReactNode

      try {
        emailContent = generateEmailTemplate(notification.template, notification.data)
      } catch (error) {
        if (error instanceof MedusaError) {
          throw error // Re-throw MedusaError for invalid template data
        }
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Failed to generate email content for template: ${notification.template}`
        )
      }

      message = {
        to: notification.to,
        from: notification.from?.trim() ?? this.config_.from,
        react: emailContent,
        subject: emailOptions.subject ?? 'You have a new notification',
        headers: emailOptions.headers,
        replyTo: emailOptions.replyTo,
        cc: emailOptions.cc,
        bcc: emailOptions.bcc,
        tags: emailOptions.tags,
        text: emailOptions.text,
        attachments: Array.isArray(notification.attachments)
          ? notification.attachments.map((attachment) => ({
              content: attachment.content,
              filename: attachment.filename,
              content_type: attachment.content_type,
              disposition: attachment.disposition ?? 'attachment',
              id: attachment.id ?? undefined
            }))
          : undefined,
        scheduledAt: emailOptions.scheduledAt
      }
    }

    // Send the email via Resend
    try {
      await this.resend.emails.send(message)
      this.logger_.log(
        `Successfully sent "${notification.template}" email to ${notification.to} via Resend`
      )
      return {} // Return an empty object on success
    } catch (error) {
      const errorCode = (error as any).code
      const responseError = (error as any).response?.body?.errors?.[0]
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Failed to send "${notification.template}" email to ${notification.to} via Resend: ${errorCode} - ${responseError?.message ?? 'unknown error'}`
      )
    }
  }
}
