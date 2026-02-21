import type { PayloadHandler } from 'payload'

import { addDataAndFileToRequest, APIError } from 'payload'

import { verifyPhoneWithOTP } from '../operations/verifyPhone.js'

type Args = {
  collection: string
}

export const getVerifyPhoneHandler =
  ({ collection }: Args): PayloadHandler =>
  async (req) => {
    await addDataAndFileToRequest(req)

    if (!req.user) {
      throw new APIError('You must be logged in to verify a phone number.', 401)
    }

    await verifyPhoneWithOTP({
      collection,
      otp: req.data?.otp,
      payload: req.payload,
      userID: req.user.id,
    })

    return Response.json({
      message: 'Successfully verified phone number.',
    })
  }
