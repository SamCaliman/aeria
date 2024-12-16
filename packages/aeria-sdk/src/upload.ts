import type { Result, EndpointError, TempId } from '@aeriajs/types'
import type { RequestConfig } from '@aeriajs/common'
import type { FileMetadata, UploadHeaders } from '@aeriajs/core'
import type { InstanceConfig } from './types.js'
import * as querystring from 'node:querystring'
import { request } from './http.js'
import { publicUrl } from './utils.js'

type UploadParams = {
  name: string
  type: string
  content: unknown
  format?:
    | 'raw'
    | 'base64'
}

export const uploader = (config: InstanceConfig) => (bearerToken?: string) => async (collectionName: keyof Collections, params: UploadParams) => {
  const qs = querystring.encode({
    name: params.name,
    format: params.format || 'raw' satisfies UploadParams['format'],
  } satisfies typeof FileMetadata)

  const url = `${publicUrl(config)}/${collectionName}/upload?${qs}`

  const headers: typeof UploadHeaders & {
    authorization?: `Bearer ${string}`
  } = {
    'x-stream-request': '1',
    'content-type': params.type,
  }

  const requestConfig = {
    params: {
      headers,
    },
  } satisfies RequestConfig

  if( bearerToken ) {
    requestConfig.params.headers.authorization = `Bearer ${bearerToken}`
  }

  const response = await request<Result.Either<EndpointError, TempId>>(
    config,
    url,
    params.content,
    requestConfig,
  )

  return response.data
}

