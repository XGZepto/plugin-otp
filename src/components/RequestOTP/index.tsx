'use client'

import type { AdminViewClientProps } from 'payload'

import { MinimalTemplate } from '@payloadcms/next/templates'
import {
  EmailField,
  Form,
  FormSubmit,
  HiddenField,
  Link,
  SelectField,
  TextField,
  useConfig,
  useTranslation,
} from '@payloadcms/ui'
import { useRouter } from 'next/navigation.js'
import { email, formatAdminURL, username } from 'payload/shared'
import React from 'react'

import { getLoginOptions } from '../../utilities/getLoginOptions.js'
import { localStorageKey } from '../shared.js'

const baseClass = 'request-otp'

type RequestOTPProps = {
  defaultToOTP?: boolean
} & AdminViewClientProps

type OTPRequestState = {
  channel?: 'email' | 'sms'
  value: string
}

export const RequestOTP: React.FC<RequestOTPProps> = (props) => {
  const { config, getEntityConfig } = useConfig()
  const { t } = useTranslation()
  const router = useRouter()

  const {
    admin: { user: userSlug },
    routes: { admin, api },
  } = config

  const otpCollectionConfig = config?.custom?.otp?.collections?.[userSlug]
  const emailEnabled = (otpCollectionConfig?.channels?.email ?? true) && !otpCollectionConfig?.disableEmail
  const smsEnabled = Boolean(otpCollectionConfig?.channels?.sms)
  const channelOptions = [
    emailEnabled ? { label: 'Email', value: 'email' } : null,
    smsEnabled ? { label: 'SMS', value: 'sms' } : null,
  ].filter(Boolean) as { label: string; value: 'email' | 'sms' }[]

  const defaultToOTP = props?.defaultToOTP === true

  const collectionConfig = getEntityConfig({ collectionSlug: userSlug })
  const { auth: authOptions } = collectionConfig
  const loginWithUsername = authOptions?.loginWithUsername
  const { canLoginWithEmail, canLoginWithUsername } = getLoginOptions(loginWithUsername ?? false)

  const [loginType] = React.useState<'email' | 'emailOrUsername' | 'username'>(() => {
    if (canLoginWithEmail && canLoginWithUsername) {
      return 'emailOrUsername'
    }
    if (canLoginWithUsername) {
      return 'username'
    }
    return 'email'
  })

  const onSuccess = React.useCallback(
    (args: unknown) => {
      const { channel, value } = args as OTPRequestState
      router.push(`${admin}/otp/login`)
      window.localStorage.setItem(
        localStorageKey,
        JSON.stringify({
          channel,
          value,
        }),
      )
    },
    [router, admin],
  )

  return (
    <MinimalTemplate className={baseClass}>
      <h3>Request a one-time password</h3>
      <br />
      <Form
        action={formatAdminURL({
          apiRoute: api,
          path: `/${userSlug}/otp/request`,
        })}
        method="POST"
        onSuccess={onSuccess}
        waitForAutocomplete
      >
        <HiddenField path="type" value={loginType} />
        {channelOptions.length > 1 ? (
          <SelectField
            field={{
              name: 'channel',
              label: 'Receive OTP via',
              options: channelOptions,
              required: true,
            }}
            path="channel"
          />
        ) : (
          <HiddenField path="channel" value={channelOptions[0]?.value || 'email'} />
        )}
        {loginType === 'email' && (
          <EmailField
            field={{
              name: 'value',
              admin: {
                autoComplete: 'email',
                placeholder: '',
              },
              label: t('general:email'),
              required: true,
            }}
            path="value"
            validate={email}
          />
        )}
        {loginType === 'username' && (
          <TextField
            field={{
              name: 'value',
              label: t('authentication:username'),
              required: true,
            }}
            path="value"
            validate={username}
          />
        )}
        {loginType === 'emailOrUsername' && (
          <TextField
            field={{
              name: 'value',
              label: t('authentication:emailOrUsername'),
              required: true,
            }}
            path="value"
            validate={(value, options) => {
              const passesUsername = username(value, options)
              const passesEmail = email(
                value,
                options as never,
              )

              if (!passesEmail && !passesUsername) {
                return `${t('general:email')}: ${passesEmail} ${t('general:username')}: ${passesUsername}`
              }

              return true
            }}
          />
        )}
        <FormSubmit size="large">Request one-time password</FormSubmit>
      </Form>
      <Link href={`${admin}/login${defaultToOTP ? '/default' : ''}`}>Back to login</Link>
    </MinimalTemplate>
  )
}
