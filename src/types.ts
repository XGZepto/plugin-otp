import type { GeneratedTypes, Payload, TypedUser } from 'payload'

export type ResolveAuthCollectionSlug<T> = 'auth' extends keyof T ? keyof T['auth'] : string

export type AuthCollectionSlug = ResolveAuthCollectionSlug<GeneratedTypes>

export type OTPPluginCollectionOptions = {
  /**
   * Configure OTP delivery channels for this collection.
   */
  channels?: {
    /**
     * Allow OTP delivery over email.
     *
     * @default true
     */
    email?: boolean
    /**
     * Allow OTP delivery over SMS. Requires a `sendOTP` function.
     */
    sms?: SMSChannelOptions
  }
  /**
   * If you would like to handle sending the OTP yourself, via SMS or similar,
   * disable the email that is sent by passing `true`.
   */
  disableEmail?: boolean
  /**
   * Define how many seconds for the one-time password to be valid. Defaults to 5 minutes.
   */
  exp?: number
  /**
   * Customize the HTML that is sent in the OTP email sent to the user.
   */
  generateOTPEmailHTML?: GenerateOTPEmailHTML
  /**
   * Customize the subject that is sent in the OTP email sent to the user.
   */
  generateOTPEmailSubject?: GenerateOTPEmailSubject
  /**
   * Hook into plugin actions.
   */
  hooks?: {
    /**
     * These hooks will run after the OTP is saved on the user.
     */
    afterSetOTP?: AfterSetOTPHook<AuthCollectionSlug>[]
  }
  /**
   * Configure phone fields used for SMS delivery / verification.
   */
  phone?: {
    /**
     * The field name used to store the phone number.
     *
     * @default "phone"
     */
    phoneField?: string
    /**
     * The field name used to store whether the phone number is verified.
     *
     * @default "phoneVerified"
     */
    verifiedField?: string
  }
}

export type OTPDeliveryChannel = 'email' | 'sms'

export type SendSMSOTPArgs<TSlug extends AuthCollectionSlug> = {
  collection: TSlug
  otp: string
  phoneNumber: string
  user: TypedUser
}

export type SendSMSOTP<TSlug extends AuthCollectionSlug> = (
  args: SendSMSOTPArgs<TSlug>,
) => Promise<void> | void

export type SMSChannelOptions = {
  sendOTP: SendSMSOTP<AuthCollectionSlug>
}

export type OTPPluginOptions = {
  /**
   * Set `admin: false` to disable any modifications to the Payload admin UI.
   * This is useful if you are using this plugin in your own frontends, but not
   * within the admin UI itself.
   *
   * Alternatively, pass an object with `defaultToOTP: true` to make OTP the default login method.
   */
  admin?:
    | {
        /**
         * When enabled, the default login page (/admin/login) will use OTP authentication.
         * The standard email/password login will still be accessible at /admin/login/default.
         *
         * @default false
         */
        defaultToOTP?: boolean
      }
    | false
  /**
   * Define options for each auth-enabled collection you want to enable OTP for.
   */
  collections: Partial<{
    [K in AuthCollectionSlug]: OTPPluginCollectionOptions | true
  }>
}

export type AfterSetOTPHook<TSlug extends AuthCollectionSlug> = (args: {
  /**
   * The collection slug that the user belongs to.
   */
  collection: TSlug
  /**
   * The one-time password that was saved on the user.
   */
  otp: string
  /**
   * The user that has requested a one-time password.
   */
  user: TypedUser
}) => Promise<void>

export type GenerateOTPEmailArgs<TSlug extends AuthCollectionSlug> = {
  /**
   * The collection slug that the user belongs to.
   */
  collection: TSlug
  /**
   * The one-time password that was saved on the user.
   */
  otp: string
  /**
   * The user that has requested a one-time password.
   */
  user: TypedUser
}

export type GenerateOTPEmailHTML = (
  args: GenerateOTPEmailArgs<AuthCollectionSlug>,
) => Promise<string> | string
export type GenerateOTPEmailSubject = (
  args: GenerateOTPEmailArgs<AuthCollectionSlug>,
) => Promise<string> | string

export type FindUserType =
  | { type: 'email'; value: string }
  | { type: 'id'; value: number | string }
  | { type: 'username'; value: string }

export type VerifyPhoneRequestArgs = {
  collection: AuthCollectionSlug
  payload: Payload
  phone: string
  userID: number | string
}

export type VerifyPhoneConfirmArgs = {
  collection: AuthCollectionSlug
  otp: string
  payload: Payload
  userID: number | string
}
