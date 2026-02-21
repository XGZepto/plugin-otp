import type { PayloadHandler } from 'payload'

import { addDataAndFileToRequest, APIError } from 'payload'

import { requestPhoneVerificationOTP } from '../operations/verifyPhone.js'

type Args = {
  collection: string
}

export const getRequestPhoneVerificationHandler =
  ({ collection }: Args): PayloadHandler =>
  async (req) => {
    await addDataAndFileToRequest(req)

    if (!req.user) {
      throw new APIError('You must be logged in to verify a phone number.', 401)
    }

    await requestPhoneVerificationOTP({
      collection,
      payload: req.payload,
      phone: req.data?.phone,
      userID: req.user.id,
    })

    return Response.json({
      message: 'Successfully sent phone verification code.',
      phone: req.data?.phone,
    })
  }
