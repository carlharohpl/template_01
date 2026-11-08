import fs from 'node:fs'
import path from 'node:path'
import { validateHtml } from '../src/hooks/base64Packaging.js'
import { validateTrackingNames } from './tracking-validation.js'

export function validateCreative(html) {
  validateTrackingNames(html)
  const fail = message => { throw new Error(`Playable validation: ${message}`) }
  if (!/<title>\s*[^<\s][^<]*<\/title>/i.test(html)) fail('missing title')
  if (Buffer.byteLength(html) > 3565158) fail('HTML exceeds validator limit of 3,565,158 bytes (3.4 MiB)')
  if (/window\s*\.\s*open\b/i.test(html)) fail('browser navigation is forbidden')
  if (/\bXMLHttpRequest\b/.test(html)) fail('network request API remains in output')
  if (/clickTag1|click[-_]?through/i.test(html)) fail('reserved tracking property')
  if (/mraid\.open\(\s*\)/.test(html)) fail('MRAID destination argument missing')
  if (/<script[^>]+(?:type=["']module|crossorigin)/i.test(html)) fail('unsupported script attributes')
  const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)]
  if (!scripts[0]?.[1].includes('src="mraid.js"')) fail('MRAID must be the first script')
  if ((html.match(/src=["']mraid\.js["']/g) || []).length !== 1) fail('exactly one MRAID request required')
  for (const match of html.matchAll(/\b(?:src|href|poster)=["']([^"']*)["']/g)) {
    if (match[1] === 'mraid.js') continue
    if (!match[1].startsWith('data:')) fail('non-inline resource')
  }
  for (const match of html.matchAll(/data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([^"'`\s)<>]*)/gi)) {
    const encoded = match[2]
    if (!encoded || Buffer.from(encoded, 'base64').toString('base64') !== encoded) fail(`invalid Base64 asset: ${match[1]}, length ${encoded.length}, near ${html.slice(Math.max(0, match.index - 60), match.index + 100)}`)
    if (match[1] === 'text/html') validateHtml(Buffer.from(encoded, 'base64').toString('utf8'), { label: 'decoded Phaser end card' })
  }
  if (!html.startsWith('<!-- ad-network:')) fail('network identifier missing')
  if (!html.includes('window.__mip.openDestination = function handleMraidOpen()')) fail('raw MRAID handler missing')
  if (!html.includes('mraid.open(destinationUrl)')) fail('raw destination call missing')
  return Buffer.byteLength(html)
}

export function playableBuild() {
  let outputDirectory
  return {
    name: 'playable-validation',
    enforce: 'post',
    configResolved(config) { outputDirectory = path.resolve(config.root, config.build.outDir) },
    buildStart() {
      const source = fs.readFileSync('index.html', 'utf8')
      if (!/<title>\s*[^<\s][^<]*<\/title>/i.test(source)) throw new Error('A nonblank title is required before building.')
    },
    generateBundle(_options, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type !== 'asset' || !asset.fileName.endsWith('.html')) continue
        let html = String(asset.source)
          .replace(/\s+type="module"/g, '')
          .replace(/\s+crossorigin(?:="[^"]*")?/g, '')

        html = '<!-- ad-network: Applovin | al -->\n' + html
        validateCreative(html)
        asset.source = html
      }
    },
    writeBundle() {
      const files = fs.readdirSync(outputDirectory)
      if (files.length !== 1 || files[0] !== 'index.html') throw new Error('Expected exactly one output: index.html')
      const size = validateCreative(fs.readFileSync(path.join(outputDirectory, 'index.html'), 'utf8'))
      if (size > 3500000) console.warn('Playable is above the 3,500,000-byte target.')
      console.log(`Validated playable: ${size.toLocaleString()} bytes.`)
    },
  }
}

export function localMraid() {
  const middleware = (request, response, next) => {
    if (request.url?.split('?')[0] !== '/mraid.js') { next(); return }
    response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' })
    response.end('')
  }
  return {
    name: 'local-mraid-preview',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}
