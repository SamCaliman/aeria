import type { ServerResponse, IncomingMessage } from 'http'
import type { MapSchemaUnion } from './schema.js'
import type { Result } from './result.js'
import type { EndpointError, StrictEndpointError } from './endpointError.js'
import type { ACError } from './accessControl.js'
import type { RateLimitingError } from './security.js'

export const REQUEST_METHODS = <const>[
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'OPTIONS',
  'PATCH',
  'TRACE',
  'SEARCH',
]

export enum HTTPStatus {
  Ok = 200,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  UnprocessableContent = 422,
  TooManyRequests = 429,
  InternalServerError = 500,
}

export type RouteUri = `/${string}`

export type RequestMethod = (typeof REQUEST_METHODS)[number]

export type GenericRequest = Omit<
  IncomingMessage,
  | 'url'
  | 'method'
> & {
  readonly url: string
  readonly method: RequestMethod
  readonly body?: string
  readonly fragments: string[]
  payload: Record<string, any>
  query: Record<string, any>
}

export const STREAMED_RESPONSE = Symbol('StreamedResponse')

export type GenericResponse = ServerResponse & {
  [STREAMED_RESPONSE]?: boolean
}

type ExtractCode<TRouteResponse> = TRouteResponse extends EndpointError<infer PCode>
  ? PCode
  : never

type ExtractHTTPStatus<TRouteResponse> = TRouteResponse extends EndpointError<any, unknown, infer PHTTPStatus>
  ? PHTTPStatus
  : never


export type NativeError =
  | ACError.AuthenticationError
  | ACError.AuthorizationError
  | RateLimitingError.LimitReached
  | RateLimitingError.Unauthenticated

export type NativeHTTPErrorStatus =
  | HTTPStatus.Unauthorized
  | HTTPStatus.TooManyRequests

export type WithACErrors<TRouteResponse> = TRouteResponse extends Result.Either<infer InferredError, infer InferredResult>
  ? Result.Either<
    | InferredError
    | StrictEndpointError<
      | ExtractCode<InferredError>
      | NativeError,
      unknown,
      | ExtractHTTPStatus<InferredError>
      | NativeHTTPErrorStatus
    >,
    InferredResult
  >
  : TRouteResponse | Result.Error<
    StrictEndpointError<
      NativeError,
      unknown,
      NativeHTTPErrorStatus
    >
  >

export type EndpointFunction<
  TRouteMethod extends RequestMethod,
  TRouteResponse,
  TRoutePayload,
> = (
  TRoutePayload extends null
    ? <T = TRouteResponse>(payload?: any)=> Promise<WithACErrors<T>>
    : TRoutePayload extends undefined
      ? <T = TRouteResponse>()=> Promise<WithACErrors<T>>
      : <T = TRouteResponse>(payload: TRoutePayload)=> Promise<WithACErrors<T>>
) extends infer Function
  ? Record<TRouteMethod, Function>
  : never

export type MakeEndpoint<
  TRoute extends string,
  TRouteMethod extends RequestMethod,
  TRouteResponse = any,
  TRoutePayload = null,
> = TRoute extends `/${infer RouteTail}`
  ? MakeEndpoint<RouteTail, TRouteMethod, TRouteResponse, TRoutePayload>
  : TRoute extends `${infer Route}/${infer RouteTail}`
    ? Record<Route, MakeEndpoint<RouteTail, TRouteMethod, TRouteResponse, TRoutePayload>>
    : TRoute extends `(${string}`
      ? Record<string, EndpointFunction<TRouteMethod, TRouteResponse, TRoutePayload>>
      : Record<TRoute, EndpointFunction<TRouteMethod, TRouteResponse, TRoutePayload>>

type UnwrapResponse<TResponse> = TResponse extends readonly any[]
  ? TResponse
  : TResponse[]

export type InferResponse<TResponse> = MapSchemaUnion<UnwrapResponse<TResponse>> extends infer InferredResponse
  ? InferredResponse | Promise<InferredResponse>
  : never

