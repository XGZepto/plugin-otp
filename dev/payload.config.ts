import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { pluginOTP } from '@payloadcms/plugin-otp'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

const getDatabaseURI = async (): Promise<string> => {
  if (process.env.DATABASE_URI) {
    return process.env.DATABASE_URI
  }

  // For integration tests, allow an explicit localhost loopback DB URI to avoid
  // mongodb-memory-server download issues in constrained environments.
  if (process.env.NODE_ENV === 'test') {
    if (process.env.MONGODB_LOOPBACK_URI) {
      process.env.DATABASE_URI = process.env.MONGODB_LOOPBACK_URI
      return process.env.DATABASE_URI
    }

    const memoryDB = await MongoMemoryReplSet.create({
      replSet: {
        count: 3,
        dbName: 'payloadmemory',
        ip: '127.0.0.1',
      },
    })

    process.env.DATABASE_URI = `${memoryDB.getUri('payloadmemory', '127.0.0.1')}&retryWrites=true`

    return process.env.DATABASE_URI
  }

  // Local dev fallback: default to localhost loopback.
  process.env.DATABASE_URI = 'mongodb://127.0.0.1:27017/payload-plugin-otp?directConnection=true'

  return process.env.DATABASE_URI
}

const buildConfigWithMemoryDB = async () => {
  const databaseURI = await getDatabaseURI()

  return buildConfig({
    admin: {
      importMap: {
        baseDir: path.resolve(dirname),
      },
    },
    collections: [],
    db: mongooseAdapter({
      ensureIndexes: true,
      url: databaseURI,
    }),
    editor: lexicalEditor(),
    email: testEmailAdapter,
    onInit: async (payload) => {
      await seed(payload)
    },
    plugins: [
      pluginOTP({
        admin: {
          defaultToOTP: true,
        },
        collections: {
          users: {
            channels: {
              sms: {
                sendOTP: ({ otp, phoneNumber }) => {
                  void otp
                  void phoneNumber
                },
              },
            },
          },
        },
      }),
    ],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  })
}

export default buildConfigWithMemoryDB()
