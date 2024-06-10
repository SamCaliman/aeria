import type { HTTPStatus } from './http.js'

export const ERROR_SYMBOL_DESCRIPTION = '#__ERROR_SYMBOL__'
export const ERROR_SYMBOL = Symbol(ERROR_SYMBOL_DESCRIPTION)

export type EndpointErrorContent<
  TCode extends string = string,
  TDetails = unknown,
  THTTPStatus extends HTTPStatus = HTTPStatus,
  TMessage extends string = string,
> = {
  code: TCode
  details?: TDetails
  httpStatus?: THTTPStatus
  message?: TMessage
}

export type StrictEndpointErrorContent<
  TCode extends string = string,
  TDetails = unknown,
  THTTPStatus extends HTTPStatus | undefined = HTTPStatus,
  TMessage extends string | undefined = string,
> = {
  code: TCode
  details?: TDetails
  httpStatus: THTTPStatus
  message?: TMessage
}

export type EndpointError<TEndpointErrorContent extends EndpointErrorContent | unknown = EndpointErrorContent> = {
  readonly _tag: 'Error'
  readonly value: TEndpointErrorContent
}

export type ExtractError<T> = T extends EndpointError
  ? T
  : never

export type ExtractSuccessful<T> = T extends EndpointError
  ? never
  : T
