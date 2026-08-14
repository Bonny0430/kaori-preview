/**
 * build.mjs — 打包 kaori-preview 客户端为 DSH ModuleLoader 格式。
 *
 * DSH web 客户端插件必须通过 __ModuleLoader__.load 注册（banner/footer 注入），
 * 服务端保持纯 ESM（Node 直接加载）。
 */
import { build } from 'esbuild'
import { mkdirSync, readFileSync } from 'node:fs'

mkdirSync('lib', { recursive: true })

const dshExternal = ['@deepseek-ai/cordis', '@deepseek-ai/dsh-*']

// 服务端：纯 ESM（Node 加载），外部化框架包
await build({
  entryPoints: ['src/index.js'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node22'],
  sourcemap: false,
  external: dshExternal,
  logLevel: 'info',
})

// 客户端：CJS bundle + ModuleLoader 包装（浏览器加载）
await build({
  entryPoints: ['src/client.js'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: false,
  external: [...dshExternal, 'react', 'react-dom', 'react/jsx-runtime', 'scheduler'],
  banner: {
    js: "window.__ModuleLoader__.load({ id: 'kaori-preview', factory: (require) => { var module = { exports: {} }; var exports = module.exports;",
  },
  footer: {
    js: 'return module.exports; } });',
  },
  logLevel: 'info',
})

console.log('build ok: lib/index.js + lib/client.js')
