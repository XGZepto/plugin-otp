import type { Plugin } from 'payload'

import { InvalidConfiguration } from 'payload'

import type { OTPPluginOptions } from './types.js'

import { defaultUserCollection } from './defaults.js'
import { getLoginHandler } from './endpoints/login.js'
import { getRequestOTPHandler } from './endpoints/request.js'
import { getRequestPhoneVerificationHandler } from './endpoints/requestPhoneVerification.js'
import { getVerifyPhoneHandler } from './endpoints/verifyPhone.js'

export const pluginOTP =
  (options: OTPPluginOptions): Plugin =>
  (config) => {
    config.custom = {
      ...(config.custom || {}),
      otp: options,
    }

    if (options.admin !== false) {
      if (!config.admin) {
        config.admin = {}
      }

      if (!config.admin.components) {
        config.admin.components = {}
      }
      if (!config.admin.components.afterLogin) {
        config.admin.components.afterLogin = []
      }

      if (!config.admin.components.views) {
        config.admin.components.views = {}
      }

      config.admin.components.afterLogin.push({
        clientProps: {
          defaultToOTP: typeof options.admin === 'object' && options.admin.defaultToOTP,
        },
        path: '@payloadcms/plugin-otp/client#AfterLoginOTP',
      })

      config.admin.components.views.requestOTP = {
        Component: '@payloadcms/plugin-otp/client#RequestOTP',
        exact: true,
        meta: {
          titleSuffix: ' - Request one-time password',
        },
        path: '/otp/request',
      }

      config.admin.components.views.loginOTP = {
        Component: {
          clientProps: {
            defaultToOTP: typeof options.admin === 'object' && options.admin.defaultToOTP,
          },
          path: '@payloadcms/plugin-otp/client#LoginOTP',
        },
        exact: true,
        meta: {
          titleSuffix: ' - Login with one-time password',
        },
        path: '/otp/login',
      }

      // If defaultToOTP is enabled, replace the default login view with OTP login
      if (typeof options.admin === 'object' && options.admin.defaultToOTP) {
        config.admin.components.views.login = {
          Component: {
            clientProps: {
              defaultToOTP: true,
            },
            path: '@payloadcms/plugin-otp/client#RequestOTP',
          },
          exact: true,
          meta: {
            titleSuffix: ' - Login with one-time password',
          },
          path: '/login',
        }

        config.admin.components.views.defaultLogin = {
          Component: {
            clientProps: {
              defaultToOTP: true,
            },
            path: '@payloadcms/plugin-otp/client#DefaultLogin',
          },
          exact: true,
          meta: {
            titleSuffix: ' - Login',
          },
          path: '/login/default',
        }
      }
    }

    Object.keys(options.collections).forEach((collectionSlug) => {
      let matchedCollection = config.collections?.find(({ slug }) => slug === collectionSlug)

      if (!matchedCollection && collectionSlug === 'users') {
        config.collections?.push(defaultUserCollection)
        matchedCollection = defaultUserCollection
      }

      if (!matchedCollection) {
        throw new InvalidConfiguration(
          `You have enabled one-time password for the collection "${collectionSlug}" which does not exist.`,
        )
      }


      const phoneField =
        typeof options.collections[collectionSlug] === 'object' &&
        options.collections[collectionSlug]?.phone?.phoneField
          ? options.collections[collectionSlug].phone.phoneField
          : 'phone'
      const verifiedField =
        typeof options.collections[collectionSlug] === 'object' &&
        options.collections[collectionSlug]?.phone?.verifiedField
          ? options.collections[collectionSlug].phone.verifiedField
          : 'phoneVerified'

      matchedCollection.fields.push({
        name: phoneField,
        type: 'text',
        index: true,
        validate: (value: unknown) => {
          if (!value) {return true}
          if (typeof value !== 'string') {
            return 'Phone must be a string.'
          }
          if (!/^\+[1-9]\d{1,14}$/.test(value)) {
            return 'Phone must be a valid E.164 number, for example +17025702347.'
          }
          return true
        },
      })

      matchedCollection.fields.push({
        name: verifiedField,
        type: 'checkbox',
        defaultValue: false,
      })

      matchedCollection.fields.push({
        name: '_otp',
        type: 'text',
        hidden: true,
        index: true,
      })

      matchedCollection.fields.push({
        name: '_otpExpiration',
        type: 'date',
        hidden: true,
        index: true,
      })

      if (!matchedCollection.endpoints) {
        matchedCollection.endpoints = []
      }

      matchedCollection.endpoints.push({
        handler: getRequestOTPHandler({ collection: collectionSlug }),
        method: 'post',
        path: '/otp/request',
      })

      matchedCollection.endpoints.push({
        handler: getLoginHandler({ collection: collectionSlug }),
        method: 'post',
        path: '/otp/login',
      })

      matchedCollection.endpoints.push({
        handler: getRequestPhoneVerificationHandler({ collection: collectionSlug }),
        method: 'post',
        path: '/otp/phone/request',
      })

      matchedCollection.endpoints.push({
        handler: getVerifyPhoneHandler({ collection: collectionSlug }),
        method: 'post',
        path: '/otp/phone/verify',
      })
    })

    return config
  }
