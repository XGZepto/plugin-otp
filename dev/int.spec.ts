import type { Payload } from 'payload'

import config from '@payload-config'
import { createLocalReq, createPayloadRequest, getPayload } from 'payload'
import { wait } from 'payload/shared'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import type { User } from './payload-types.js'

import { getLoginHandler } from '../src/endpoints/login.js'
import { getRequestOTPHandler } from '../src/endpoints/request.js'
import { getRequestPhoneVerificationHandler } from '../src/endpoints/requestPhoneVerification.js'
import { getVerifyPhoneHandler } from '../src/endpoints/verifyPhone.js'
import { loginWithOTP } from '../src/operations/login.js'
import { setOTP } from '../src/operations/requestOTP.js'
import { devUser } from './helpers/credentials.js'

let payload: Payload

afterAll(async () => {
  if (payload?.db?.destroy) {
    await payload.db.destroy()
  }
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

describe('REST', () => {
  const requestOTPHandler = getRequestOTPHandler({ collection: 'users' })
  const loginHandler = getLoginHandler({ collection: 'users' })

  test('reject OTP login if bad OTP', async () => {
    const request = new Request('http://localhost:3000/api/users/otp/login', {
      body: JSON.stringify({
        type: 'email',
        otp: '123456',
        value: devUser.email,
      }),
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      method: 'POST',
    })

    const payloadRequest = await createPayloadRequest({ config, request })

    await expect(loginHandler(payloadRequest)).rejects.toThrowError(
      'The following field is invalid: One-time password',
    )
  })

  test('sends otp over sms using generic provider', async () => {
    const sendOTP = vi.fn(async () => {})
    payload.config.custom.otp.collections.users = {
      ...(payload.config.custom.otp.collections.users || {}),
      channels: {
        email: true,
        sms: {
          sendOTP,
        },
      },
    }

    const user = await payload.db.findOne<User>({
      collection: 'users',
      where: {
        email: {
          equals: devUser.email,
        },
      },
    })

    await payload.db.updateOne({
      id: user!.id,
      collection: 'users',
      data: {
        phone: '+17025551234',
      },
    })

    const { otp } = await setOTP({
      type: 'email',
      channel: 'sms',
      collection: 'users',
      payload,
      value: devUser.email,
    })

    expect(otp).toBeTypeOf('string')
    expect(sendOTP).toHaveBeenCalledOnce()
  })

  test('requests and logs in with email + OTP', async () => {
    const request1 = new Request('http://localhost:3000/api/users/otp/request', {
      body: JSON.stringify({
        type: 'email',
        value: devUser.email,
      }),
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      method: 'POST',
    })

    const payloadRequest1 = await createPayloadRequest({ config, request: request1 })
    const { payload } = payloadRequest1

    const logSpy = vi.spyOn(payload.email, 'sendEmail').mockImplementation(async () => {})

    await requestOTPHandler(payloadRequest1)

    const userFromDB = await payload.db.findOne<User>({
      collection: 'users',
      where: {
        email: {
          equals: devUser.email,
        },
      },
    })

    if (!userFromDB) {
      throw new Error('cant find dev user')
    }

    expect(userFromDB._otp).toBeTypeOf('string')
    expect(userFromDB._otpExpiration).toBeTypeOf('string')

    const calls = logSpy.mock.calls
    const otp = calls[0][0].html.match(/\d{6}/)[0]

    expect(otp).toBeTypeOf('string')

    const request2 = new Request('http://localhost:3000/api/users/otp/login', {
      body: JSON.stringify({
        type: 'email',
        otp,
        value: devUser.email,
      }),
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      method: 'POST',
    })

    const payloadRequest = await createPayloadRequest({ config, request: request2 })
    const res = await loginHandler(payloadRequest)

    const setCookieHeader = res.headers.get('Set-Cookie')

    expect(setCookieHeader?.startsWith('payload-token')).toBeTruthy()
    expect(res.status).toBe(200)
  })
})



describe('phone verification routes', () => {
  const requestPhoneVerificationHandler = getRequestPhoneVerificationHandler({ collection: 'users' })
  const verifyPhoneHandler = getVerifyPhoneHandler({ collection: 'users' })

  test('requests phone verification OTP via SMS and verifies phone', async () => {
    const request = new Request('http://localhost:3000/api/users/otp/phone/request', {
      body: JSON.stringify({
        phone: '+17025702347',
      }),
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      method: 'POST',
    })

    const payloadRequest = await createPayloadRequest({ config, request })
    const userQuery = await payload.find({
      collection: 'users',
      limit: 1,
      where: {
        email: {
          equals: devUser.email,
        },
      },
    })

    payloadRequest.user = userQuery.docs[0]

    const sendOTP = vi.fn(async () => {})
    payloadRequest.payload.config.custom.otp.collections.users = {
      ...(payloadRequest.payload.config.custom.otp.collections.users || {}),
      channels: {
        email: true,
        sms: {
          sendOTP,
        },
      },
    }

    await requestPhoneVerificationHandler(payloadRequest)

    const updatedUser = await payload.db.findOne<User>({
      collection: 'users',
      where: {
        email: {
          equals: devUser.email,
        },
      },
    })

    expect(updatedUser?.phone).toBe('+17025702347')
    expect(updatedUser?.phoneVerified).toBe(false)
    expect(sendOTP).toHaveBeenCalledOnce()

    const otp = await setOTP({
      type: 'id',
      channel: 'sms',
      collection: 'users',
      payload,
      value: updatedUser!.id,
    })

    const verifyReq = new Request('http://localhost:3000/api/users/otp/phone/verify', {
      body: JSON.stringify({
        otp: otp.otp,
      }),
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      method: 'POST',
    })

    const verifyPayloadReq = await createPayloadRequest({ config, request: verifyReq })
    verifyPayloadReq.user = updatedUser as User

    await verifyPhoneHandler(verifyPayloadReq)

    const verifiedUser = await payload.db.findOne<User>({
      collection: 'users',
      where: {
        email: {
          equals: devUser.email,
        },
      },
    })

    expect(verifiedUser?.phoneVerified).toBe(true)
  })
})

describe('local operations', () => {
  test('reject OTP login if bad OTP', async () => {
    const req = await createLocalReq({}, payload)

    await expect(
      loginWithOTP({
        type: 'email',
        collection: 'users',
        otp: 'bad',
        req,
        value: devUser.email,
      }),
    ).rejects.toThrowError('The following field is invalid: One-time password')
  })

  test('rejects expired otp', async () => {
    const req = await createLocalReq({}, payload)

    const { otp } = await setOTP({
      type: 'email',
      collection: 'users',
      // Override exp to 1 sec
      exp: 1,
      payload,
      value: devUser.email,
    })

    await wait(1000)

    await expect(
      loginWithOTP({
        type: 'email',
        collection: 'users',
        otp,
        req,
        value: devUser.email,
      }),
    ).rejects.toThrowError('The following field is invalid: One-time password')
  })

  test('requests and logs in with email + OTP', async () => {
    const req = await createLocalReq({}, payload)

    const { otp } = await setOTP({
      type: 'email',
      collection: 'users',
      payload,
      value: devUser.email,
    })

    expect(otp).toBeTypeOf('string')

    const result = await loginWithOTP({
      type: 'email',
      collection: 'users',
      otp,
      req,
      value: devUser.email,
    })

    expect(result.token).toBeTypeOf('string')
    expect(result.user.email).toStrictEqual(devUser.email)
  })
})
