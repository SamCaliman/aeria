import type { Middleware, MiddlewareNext, GenericMiddlewareNext, Context } from '@aeriajs/types'

export const iterableMiddlewares = function <TReturn, TPayload, TReturnNext extends GenericMiddlewareNext<TReturn, TPayload> = MiddlewareNext>(middlewares: Middleware<TReturn, TPayload, TReturnNext>[]) {
  const [first, ...subsequent] = middlewares
  const it: Generator<GenericMiddlewareNext<TReturn, TPayload>> = function *() {
    for( const middleware of subsequent.concat([(_, initial) => initial]) ) {
      yield (payload: TPayload, initial: TReturn, context: Context) => {
        const { value: next } = it.next()
        return middleware(payload, initial, context, next)
      }
    }
  }()

  return (payload: TPayload, initial: TReturn, context: Context) => {
    const { value: next } = it.next()
    return first(payload, initial, context, next)
  }
}
