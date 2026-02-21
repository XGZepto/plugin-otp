export const e164Regex = /^\+[1-9]\d{1,14}$/

export const isValidE164Phone = (value: unknown): value is string =>
  typeof value === 'string' && e164Regex.test(value)
