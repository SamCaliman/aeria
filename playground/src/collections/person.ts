import { defineCollection, get, getAll, insert } from 'aeria'

export const person = defineCollection({
  description: {
    $id: 'person',
    properties: {
      name: {
        type: 'string',
      },
      job: {
        enum: [
          'driver',
          'baker',
          'programmer',
          'policeman',
        ],
      },
      pets: {
        type: 'array',
        items: {
          $ref: 'pet',
        },
      },
    },
  },
  functions: {
    get,
    getAll,
    insert,
    hello: (obj) => {
      obj.name
      // @ts-expect-error
      obj.invalid
      return {
        success: true,
      }
    },
  },
  exposedFunctions: {
    hello: true,
  },
  accessControl: {
    roles: {
      root: {
        grantEverything: true,
      },
      guest: {
        inherit: ['root'],
        grant: ['getAll'],
      },
    },
  },
  functionContracts: {
    hello: {
      payload: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
        },
      },
      response: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
          },
        },
      },
    },
  },
})

