import type { PackReferences } from '@aeriajs/types'
import { getConfig } from '@aeriajs/entrypoint'
import { MongoClient } from 'mongodb'
export {
  ObjectId,
} from 'mongodb'

const dbMemo = {} as {
  client: MongoClient
  db: ReturnType<MongoClient['db']> | undefined
}

export const getDatabase = async () => {
  if( !dbMemo.db ) {
    const config = await getConfig()

    const mongodbUri = await (async () => {
      const envUri = config.database?.mongodbUrl

      if( !envUri ) {
        console.warn('mongo URI wasn\'t supplied, fallbacking to memory storage (this means your data will only be alive during runtime)')

        const { MongoMemoryServer }: any = await import('mongodb-memory-server')

        const mongod = await MongoMemoryServer.create()
        return mongod.getUri()
      }

      return envUri
    })()

    const logQueries = config.database?.logQueries || process.env.NODE_ENV === 'debug'

    const client = new MongoClient(mongodbUri, {
      monitorCommands: logQueries
    })

    if( logQueries ) {
      client.on('commandStarted', (event) => {
        try {
          console.debug(JSON.stringify(event, null, 2))
        } catch( err ) {
          console.debug(event)
        }
      })
    }

    dbMemo.client = client
    dbMemo.db = client.db()
  }

  return dbMemo
}

export const getDatabaseSync = () => {
  if( !dbMemo.db ) {
    throw new Error('getDatabaseSync() called with no active database')
  }

  return dbMemo.db
}

export const prepareCollectionName = (collectionName: string) => {
  const pluralized = collectionName.endsWith('s')
    ? `${collectionName}es`
    : `${collectionName}s`

  return pluralized.toLowerCase()
}

export const getDatabaseCollection = <TDocument extends Record<string, any>>(collectionName: string) => {
  const db = getDatabaseSync()
  return db.collection<PackReferences<TDocument>>(prepareCollectionName(collectionName))
}

