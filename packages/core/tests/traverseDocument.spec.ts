import type { InsertOneResult } from 'mongodb'
import type { RouteContext, Description } from '@aeriajs/types'
import { expect, test, assert, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { ACError, PropertyValidationErrorCode, ValidationErrorCode } from '@aeriajs/types'
import { ObjectId } from '../src/index.js'
import { createContext, traverseDocument } from '../dist/index.js'
import { dbPromise } from './fixtures/database.js'

let
  context: RouteContext,
  persistentFs: string,
  tempFs: string,
  tempFile1: InsertOneResult,
  tempFile2: InsertOneResult,
  tempPath1: string,
  tempPath2: string,
  persistentPath1: string,
  persistentPath2: string

const description: Description = {
  $id: 'person',
  properties: { name: { type: 'string' } },
}

beforeAll(async () => {
  await dbPromise
  persistentFs = await fs.promises.mkdtemp(path.join(tmpdir(), 'aeria-'))
  tempFs = await fs.promises.mkdtemp(path.join(tmpdir(), 'aeria-'))

  context = await createContext({
    config: {
      security: {},
      storage: {
        fs: persistentFs,
        tempFs,
      },
    },
  })

  tempPath1 = path.join(tempFs, 'tempFile1.bin')
  tempPath2 = path.join(tempFs, 'tempFile2.bin')
  persistentPath1 = path.join(persistentFs, path.basename(tempPath1))
  persistentPath2 = path.join(persistentFs, path.basename(tempPath2))

  await fs.promises.writeFile(tempPath1, '')
  await fs.promises.writeFile(tempPath2, '')

  tempFile1 = await context.collections.tempFile.model.insertOne({
    name: path.basename(tempPath1),
    absolute_path: tempPath1,
  })

  tempFile2 = await context.collections.tempFile.model.insertOne({
    name: path.basename(tempPath2),
    absolute_path: tempPath2,
  })
})

test('returns a validation error on shallow invalid property', async () => {
  const what = { prop: 1 }

  const { error } = await traverseDocument(what, {
    $id: '',
    properties: { prop: { type: 'string' } },
  }, { validate: true })

  assert(typeof error === 'object')
  expect(error.code).toBe(ValidationErrorCode.InvalidProperties)
})

test('returns a validation error on deep invalid property', async () => {
  const what = { deep: { prop: 1 } }

  const { error } = await traverseDocument(what, {
    $id: '',
    properties: {
      deep: {
        type: 'object',
        properties: { prop: { type: 'string' } },
      },
    },
  }, { validate: true })

  assert(typeof error === 'object')
  assert(error.code === ValidationErrorCode.InvalidProperties)
  assert('code' in error.errors.deep)
  assert(error.errors.deep.code === ValidationErrorCode.InvalidProperties)
  assert('type' in error.errors.deep.errors.prop)
  expect(error.errors.deep.errors.prop.type).toBe(PropertyValidationErrorCode.Unmatching)
})

test('returns a validation error on incomplete nested object', async () => {
  const what = { deep: { prop: null } }

  const { error } = await traverseDocument(what, {
    $id: '',
    properties: {
      deep: {
        type: 'object',
        properties: { prop: { type: 'string' } },
      },
    },
  }, {
    validate: true,
    validateWholeness: true,
    recurseDeep: true,
  })

  assert(typeof error === 'object')
  assert(error.code === ValidationErrorCode.MissingProperties)
  expect(error.errors.prop.type).toBe('missing')
})

test('returns a validation error on invalid array element', async () => {
  const what = {
    array: [
      '1',
      '2',
      3,
    ],
  }

  const { error } = await traverseDocument(what, {
    $id: '',
    properties: {
      array: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  }, { validate: true })

  assert(typeof error === 'object')
  assert(error.code === ValidationErrorCode.InvalidProperties)
  assert('type' in error.errors.array)
  assert(error.errors.array.type === PropertyValidationErrorCode.Unmatching)
  expect(error.errors.array.index).toBe(2)
})

test('returns a validation error on invalid array element inside deep property', async () => {
  const what = {
    deep: {
      array: [
        '1',
        '2',
        3,
      ],
    },
  }

  const { error } = await traverseDocument(what, {
    $id: '',
    properties: {
      deep: {
        type: 'object',
        properties: {
          array: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  }, { validate: true })

  assert(typeof error === 'object')
  assert(error.code === ValidationErrorCode.InvalidProperties)
  assert('code' in error.errors.deep)
  assert(error.errors.deep.code === ValidationErrorCode.InvalidProperties)
  assert('type' in error.errors.deep.errors.array)
  expect(error.errors.deep.errors.array.type === PropertyValidationErrorCode.Unmatching)
  expect(error.errors.deep.errors.array.index).toBe(2)
})

test('autocast deep MongoDB operators', async () => {
  const what = {
    items: {
      $elemMatch: {
        date: '2023-10-31T21:57:45.943Z',
        image: '653c3d448a707ef3d327f624',
        status: 'accepted',
      },
    },
  }

  const { result } = await traverseDocument(what, {
    $id: '',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              format: 'date-time',
            },
            image: { $ref: 'file' },
            status: { type: 'string' },
          },
        },
      },
    },
  }, {
    autoCast: true,
    allowOperators: true,
  })

  assert(result)
  expect(result.items.$elemMatch.date).toBeInstanceOf(Date)
  expect(result.items.$elemMatch.image).toBeInstanceOf(ObjectId)
  expect(result.items.$elemMatch.status).toBe('accepted')
})

test('autocast top-level MongoDB operators', async () => {
  const what = {
    $and: [
      { date: '2023-10-31T21:57:45.943Z' },
      { image: '653c3d448a707ef3d327f624' },
      { status: 'accepted' },
    ],
  }

  const { result } = await traverseDocument(what, {
    $id: '',
    properties: {
      date: {
        type: 'string',
        format: 'date-time',
      },
      image: { $ref: 'file' },
      status: { type: 'string' },
    },
  }, {
    autoCast: true,
    allowOperators: true,
  })

  assert(result)
  expect(result.$and[0].date).toBeInstanceOf(Date)
  expect(result.$and[1].image).toBeInstanceOf(ObjectId)
  expect(result.$and[2].status).toBe('accepted')
})

test('moves single file', async () => {
  const what = { single_file: { tempId: tempFile1.insertedId } }

  const { result } = await traverseDocument(what, {
    $id: 'person',
    properties: { single_file: { $ref: 'file' } },
  }, {
    moveFiles: true,
    context,
  })

  assert(result)
  expect(result.single_file).toBeInstanceOf(ObjectId)
  expect(fs.existsSync(persistentPath1)).toBeTruthy()
  await fs.promises.writeFile(tempPath1, '')
  await fs.promises.unlink(persistentPath1)
})

test('moves multiple files', async () => {
  const what = {
    multiple_files: [
      { tempId: tempFile1.insertedId },
      { tempId: tempFile2.insertedId },
      new ObjectId,
    ],
  }

  const { result } = await traverseDocument(what, {
    $id: 'person',
    properties: {
      multiple_files: {
        type: 'array',
        items: { $ref: 'file' },
      },
    },
  }, {
    moveFiles: true,
    recurseDeep: true,
    context,
  })

  assert(result)
  expect(result.multiple_files).toBeInstanceOf(Array)
  expect(result.multiple_files[0]).toBeInstanceOf(ObjectId)
  expect(result.multiple_files[1]).toBeInstanceOf(ObjectId)
  expect(result.multiple_files[2]).toBeInstanceOf(ObjectId)
  expect(fs.existsSync(path.join(persistentFs, path.basename(tempPath1)))).toBeTruthy()
  expect(fs.existsSync(persistentPath1)).toBeTruthy()
  expect(fs.existsSync(persistentPath2)).toBeTruthy()
})

test('cleanup references', async () => {
  const { db } = await dbPromise
  if( !db ) {
    throw new Error
  }

  const { insertedId: refId } = await db.collection('person').insertOne({})
  const { insertedId: docId } = await db.collection('person').insertOne({ nested: { person: refId } })

  const { result } = await traverseDocument({
    _id: docId,
    nested: { person: new ObjectId },
  }, {
    $id: 'person',
    properties: {
      nested: {
        type: 'object',
        properties: {
          person: {
            $ref: 'person',
            inline: true,
          },
        },
      },
    },
  }, {
    recurseDeep: true,
    cleanupReferences: true,
    context,
  })

  const ref = await db.collection('person').findOne({ _id: refId })

  assert(result)
  expect(ref).toBeNull()
})

test('forbids MongoDB operators unless explicitly allowed', async () => {
  const { error: shouldFail1 } = await traverseDocument({ name: { $eq: 'terry' } }, description, { allowOperators: false })
  const { error: shouldFail2 } = await traverseDocument({
    name: {
      something: 1,
      $eq: 'terry',
    },
  }, description, { allowOperators: false })
  const { error: shouldFail3 } = await traverseDocument({ inexistent: { $eq: 'terry' } }, description, { allowOperators: false })

  const { result: shouldSucceed } = await traverseDocument({ name: { $eq: 'terry' } }, description, { allowOperators: true })

  assert(shouldFail1)
  expect(shouldFail1).toBe(ACError.InsecureOperator)
  assert(shouldFail2)
  expect(shouldFail2).toBe(ACError.InsecureOperator)
  assert(shouldFail3)
  expect(shouldFail3).toBe(ACError.InsecureOperator)
  assert(shouldSucceed)
})

test('escapes $regex queries by default', async () => {
  const { result: result1 } = await traverseDocument({ name: { $regex: '^te+rry$' } }, description, { allowOperators: true })
  const { result: result2 } = await traverseDocument({ name: { $regex: '^te+rry$' } }, description, {
    allowOperators: true,
    noRegExpEscaping: true,
  })

  assert(result1)
  expect(result1.name.$regex).toBe('\\^te\\+rry\\$')
  assert(result2)
  expect(result2.name.$regex).toBe('^te+rry$')
})

