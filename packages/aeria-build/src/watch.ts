import type { BuildContext } from 'esbuild'
import chokidar from 'chokidar'
import path from 'path'
import ts from 'typescript'
import { spawn, fork, type ChildProcessWithoutNullStreams } from 'child_process'
import { WATCH_BUILD_PATH } from './constants.js'
import { compile } from './compile.js'
import { log } from './log.js'
import { mirrorSdk } from './mirrorSdk.js'
import * as transpile from './transpile.js'

const processEnv = Object.assign({
  AERIA_MAIN: '.aeria/dist/index.js',
}, process.env)

type WatchOptions = {
  commonjs?: boolean
}

const compileOnChanges = async (transpileCtx: BuildContext) => {
  try {
    await transpileCtx.rebuild()
    return {
      success: true,
    }
  } catch( err: any ) {
    console.log(err.message)
  }

  return {
    success: false,
  }
}

export const spawnApi = async () => {
  const api = spawn('node', [
    '-r',
    'aeria/loader',
    '--preserve-symlinks',
    '--env-file=.env',
    '--experimental-specifier-resolution=node',
    '.aeria/dist/index.js',
  ], {
    env: processEnv,
  })

  api.stdout.pipe(process.stdout)
  api.stderr.pipe(process.stderr)

  return api
}

export const watch = async (options: WatchOptions = {}) => {
  const transpileCtx = await transpile.init({
    format: options.commonjs
      ? 'cjs'
      : 'esm',
  })

  const initialCompilationResult = await compileOnChanges(transpileCtx)

  let runningApi: ChildProcessWithoutNullStreams | undefined
  process.env.AERIA_MAIN = '.aeria/dist/index.js'

  process.on('SIGINT', () => {
    transpileCtx.dispose()
    if( runningApi ) {
      runningApi.kill()
    }

    process.exit(0)
  })

  if( initialCompilationResult.success ) {
    runningApi = await spawnApi()
    await mirrorSdk()
  }

  const srcWatcher = chokidar.watch([
    './src',
    './package.json',
    './tsconfig.json',
    './.env',
  ])

  srcWatcher.on('change', async (filePath) => {
    if( runningApi ) {
      runningApi.kill()

      if( runningApi.connected ) {
        await new Promise<void>((resolve) => {
          runningApi!.on('exit', () => {
            resolve()
          })
        })
      }
    }

    console.clear()
    log('info', `change detected in file: ${filePath}`)
    log('info', 'compiling...')

    const compilationResult = await compileOnChanges(transpileCtx)
    if( compilationResult.success ) {
      runningApi = await spawnApi()

      await compile({
        outDir: WATCH_BUILD_PATH,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.Node16,
        emitDeclarationOnly: true,
      })

      fork(path.join(__dirname, 'watchWorker.js'), {
        env: processEnv,
        detached: true,
      })
    }
  })
}

