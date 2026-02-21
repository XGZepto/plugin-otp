import type { Payload } from 'payload'

import { APIError } from 'payload'

import type { AuthCollectionSlug } from '../types.js'

import { encrypt } from '../utilities/encrypt.js'
import { findUser } from '../utilities/findUser.js'
import { isValidE164Phone } from '../utilities/phone.js'
import { setOTP } from './requestOTP.js'

export const requestPhoneVerificationOTP = async ({
  collection,
  payload,
  phone,
  userID,
}: {
  collection: AuthCollectionSlug
  payload: Payload
  phone: string
  userID: number | string
}) => {
  if (!isValidE164Phone(phone)) {
    throw new APIError('Phone must be a valid E.164 number (e.g. +17025702347).', 400)
  }

  const collectionOptions = payload.config.custom.otp.collections[collection]

  if (!collectionOptions?.channels?.sms?.sendOTP) {
    throw new APIError('SMS delivery is not enabled for this collection.', 400)
  }

  const phoneField = collectionOptions?.phone?.phoneField || 'phone'
  const verifiedField = collectionOptions?.phone?.verifiedField || 'phoneVerified'

  await payload.db.updateOne({
    id: userID,
    collection,
    data: {
      [phoneField]: phone,
      [verifiedField]: false,
    },
    select: {},
  })

  return setOTP({
    type: 'id',
    channel: 'sms',
    collection,
    payload,
    value: userID,
  })
}

export const verifyPhoneWithOTP = async ({
  collection,
  otp,
  payload,
  userID,
}: {
  collection: AuthCollectionSlug
  otp: string
  payload: Payload
  userID: number | string
}) => {
  if (!otp) {
    throw new APIError('No one-time password provided.', 400)
  }

  const collectionOptions = payload.config.custom.otp.collections[collection]
  const verifiedField = collectionOptions?.phone?.verifiedField || 'phoneVerified'

  const user = await findUser({
    type: 'id',
    collection,
    otp: encrypt({ payload, value: otp }),
    payload,
    value: userID,
  })

  await payload.db.updateOne({
    id: user.id,
    collection,
    data: {
      _otp: null,
      _otpExpiration: null,
      [verifiedField]: true,
    },
    select: {},
  })

  return user
}
