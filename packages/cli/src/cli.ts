import type { Result } from '@aeriajs/types'
import { parseArgs } from 'node:util'
import { log } from './log.js'
import { compilationPhase } from './compile.js'
import { watch } from './watch.js'
import { migrate } from './migrate.js'
import { iconsExtraction } from './iconsExtraction.js'
import { mirrorSdk } from './mirrorSdk.js'
import { buildAeriaLangPhase } from './buildAeriaLang.js'

const { values: opts } = parseArgs({
  options: {
    watch: {
      type: 'boolean',
      short: 'w',
    },
    compile: {
      type: 'boolean',
      short: 'c',
    },
    icons: {
      type: 'boolean',
      short: 'i',
    },
    migrate: {
      type: 'boolean',
      short: 'm',
    },
    sdk: {
      type: 'boolean',
      short: 'k',
    },
    tsc: {
      type: 'boolean',
      short: 't',
    },
  },
})

const phases: (()=> Promise<Result.Either<string, string>>)[] = []

export async function main() {
  if( opts.watch ) {
    return watch({
      useTsc: opts.tsc,
    })
  }

  if( opts.compile ) {
    phases.push(buildAeriaLangPhase)
    phases.push(() => compilationPhase({
      useTsc: opts.tsc,
    }))
  }

  if( opts.icons ) {
    phases.push(iconsExtraction)
  }

  if( opts.migrate ) {
    phases.push(migrate)
  }

  if( opts.sdk ) {
    phases.push(mirrorSdk)
  }

  for( const phase of phases ) {
    const { error, result } = await phase()
    if( error ) {
      log('error', error)
      log('info', 'pipeline aborted')
      process.exit(1)
    }

    log('info', result!)
  }
}

