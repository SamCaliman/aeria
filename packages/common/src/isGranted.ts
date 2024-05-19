import type { AccessCondition, Token } from '@aeriajs/types' 
import { arraysIntersects } from './arraysIntersects.js'

export const isGranted = (condition: AccessCondition, token: Token) => {
  if( Array.isArray(condition) ) {
    return token.authenticated
      ? arraysIntersects(token.roles, condition)
      : condition.includes('guest')
  }

  switch( condition ) {
    case true:
    case false:
      return condition
    case 'unauthenticated':
      return true
    case 'unauthenticated-only':
      return !token.authenticated
  }
}

