import { Button, Link, Section, Text, Img, Hr } from '@react-email/components'
import { Base } from './base'

/**
 * The key for the PasswordReset template, used to identify it
 */
export const PASSWORD_RESET = 'password-reset'

/**
 * The props for the PasswordReset template
 */
export interface PasswordResetEmailProps {
  /**
   * The link that the user can click to reset their password
   */
  resetLink: string
  /**
   * The preview text for the email
   */
  preview?: string
}

/**
 * Type guard for checking if the data is of type PasswordResetEmailProps
 */
export const isPasswordResetData = (data: any): data is PasswordResetEmailProps =>
  typeof data.resetLink === 'string' && (typeof data.preview === 'string' || !data.preview)

/**
 * The PasswordReset template component built with react-email
 */
export const PasswordResetEmail = ({
  resetLink,
  preview = 'Reset your password',
}: PasswordResetEmailProps) => {
  return (
    <Base preview={preview}>
      <Section className="mt-[32px]">
        <Img
          src="https://user-images.githubusercontent.com/59018053/229103275-b5e482bb-4601-46e6-8142-244f531cebdb.svg"
          alt="Medusa"
          className="mx-auto w-28"
        />
      </Section>
      <Section className="text-center">
        <Text className="text-black text-[14px] leading-[24px]">
          We received a request to reset your password. Click the button below to choose a new password.
        </Text>
        <Section className="mt-4 mb-[32px]">
          <Button
            className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline px-5 py-3"
            href={resetLink}
          >
            Reset Password
          </Button>
        </Section>
        <Text className="text-black text-[14px] leading-[24px]">
          or copy and paste this URL into your browser:
        </Text>
        <Text style={{
          maxWidth: '100%',
          wordBreak: 'break-all',
          overflowWrap: 'break-word'
        }}>
          <Link
            href={resetLink}
            className="text-blue-600 no-underline"
          >
            {resetLink}
          </Link>
        </Text>
      </Section>
      <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
      <Text className="text-[#666666] text-[12px] leading-[24px]">
        If you did not request a password reset, you can safely ignore this email.
        Your password will remain unchanged. This link will expire in 1 hour.
      </Text>
    </Base>
  )
}

PasswordResetEmail.PreviewProps = {
  resetLink: 'https://mywebsite.com/app/reset-password?token=abc123'
} as PasswordResetEmailProps

export default PasswordResetEmail
