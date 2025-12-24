import { INotificationModuleService } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { BACKEND_URL } from '../lib/constants'
import { EmailTemplates } from '../modules/email-notifications/templates'

interface PasswordResetData {
  entity_id: string
  token: string
  actor_type: string
}

export default async function passwordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetData>) {
  const notificationModuleService: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION,
  )

  // Get the user's email from the entity_id
  const userService = container.resolve(Modules.USER)

  let email: string | undefined

  try {
    // entity_id is the user ID
    const user = await userService.retrieveUser(data.entity_id)
    email = user.email
  } catch (error) {
    console.error('Failed to retrieve user for password reset:', error)
    return
  }

  if (!email) {
    console.error('No email found for user:', data.entity_id)
    return
  }

  // Build the reset link - for admin users
  const resetLink = `${BACKEND_URL}/app/reset-password?token=${data.token}`

  try {
    await notificationModuleService.createNotifications({
      to: email,
      channel: 'email',
      template: EmailTemplates.PASSWORD_RESET,
      data: {
        emailOptions: {
          replyTo: 'support@radicalz.io',
          subject: 'Reset Your Password'
        },
        resetLink,
        preview: 'Reset your password'
      }
    })
    console.log(`Password reset email sent to ${email}`)
  } catch (error) {
    console.error('Failed to send password reset email:', error)
  }
}

export const config: SubscriberConfig = {
  event: 'auth.password_reset'
}
