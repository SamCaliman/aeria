import type { AssetType, Context, Collection, Token } from '@aeriajs/types'
import { ACErrors } from '@aeriajs/types'
import { left, right, isLeft, unwrapEither } from '@aeriajs/common'
import { limitRate } from '@aeriajs/security'
import { getCollection } from '@aeriajs/entrypoint'
import { isFunctionExposed } from './endpoints.js'

const assetsMemo: {
  assets: Record<string, Record<string, Awaited<ReturnType<typeof internalGetCollectionAsset>>> | undefined>
} = {
  assets: {},
}

export const internalGetCollectionAsset = async <
  TCollectionName extends string,
  TAssetName extends keyof Collections[TCollectionName] & AssetType,
>(
  collectionName: TCollectionName,
  assetName: TAssetName,
) => {
  const collection = await getCollection(collectionName)
  const asset = collection?.[assetName as AssetType]

  if( !asset ) {
    if( !collection ) {
      return left(ACErrors.ResourceNotFound)
    }
    return left(ACErrors.AssetNotFound)
  }

  return right(asset)
}

export const getCollectionAsset = async <
  TCollectionName extends string,
  TAssetName extends keyof Collections[TCollectionName] & AssetType,
>(
  collectionName: TCollectionName,
  assetName: TAssetName,
) => {
  const cached = assetsMemo.assets[collectionName]
  if( cached?.[assetName] ) {
    return right(cached[assetName] as NonNullable<Collection[TAssetName]>)
  }

  const assetEither = await internalGetCollectionAsset(collectionName, assetName)
  if( isLeft(assetEither) ) {
    return assetEither
  }

  const asset = unwrapEither(assetEither) as NonNullable<Collection[TAssetName]>
  assetsMemo.assets[collectionName] ??= {}
  assetsMemo.assets[collectionName]![assetName] = asset

  return right(asset)
}

export const getFunction = async <
  TCollectionName extends string,
  TFunctionName extends string,
>(
  collectionName: TCollectionName,
  functionName: TFunctionName,
  acProfile?: Token,
  options = {
    exposedOnly: false,
  },
) => {
  const functionsEither = await getCollectionAsset(collectionName, 'functions')
  if( isLeft(functionsEither) ) {
    return functionsEither
  }

  const functions = unwrapEither(functionsEither)
  if( !(functionName in functions) ) {
    return left(ACErrors.FunctionNotFound)
  }

  const collection = await getCollection(collectionName)
  const fn = functions[functionName]

  if( !collection ) {
    return left(ACErrors.ResourceNotFound)
  }

  if( options.exposedOnly ) {
    if( !await isFunctionExposed(collection, functionName) ) {
      return left(ACErrors.FunctionNotExposed)
    }
  }

  // if( acProfile ) {
  //   if( !await isGranted(collectionName, functionName, acProfile) ) {
  //     return left(ACErrors.AuthorizationError)
  //   }
  // }
  //

  const wrapper = async (payload: unknown, context: Context) => {
    const securityPolicy = collection.security?.functions?.[functionName]

    if( securityPolicy ) {
      if( securityPolicy.rateLimiting ) {
        const rateLimitingEither = await limitRate(securityPolicy.rateLimiting, context)
        if( isLeft(rateLimitingEither) ) {
          return left({
            error: unwrapEither(rateLimitingEither),
            httpCode: 429,
          })
        }
      }
    }

    return fn(payload, context)
  }

  return right(wrapper)
}

