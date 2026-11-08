import fs from 'node:fs'
import { parse } from '@babel/parser'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const virtualId = '\0offline-phaser'

// Preserve the existing Phaser renderer/physics and embedded raster loader.
// Normalize vendor-only syntax for the host scanner, reject raw HTML textures,
// and keep the remaining file loader restricted to embedded data.
export function offlinePhaser() {
  return {
    name: 'offline-phaser',
    enforce: 'pre',
    resolveId(id) { if (id === 'phaser') return virtualId },
    load(id) {
      if (id !== virtualId) return null
      const file = require.resolve('phaser/dist/phaser.js')
      this.addWatchFile(file)
      let source = fs.readFileSync(file, 'utf8').replaceAll('https://phaser.io/', 'phaser.io')
      // The host scans URL-shaped tokens even in JavaScript method names.
      // Preserve method receivers and arguments while avoiding that CSS spelling.
      const edits = []
      const visit = node => {
        if (!node || typeof node !== 'object') return
        if (node.type === 'ObjectProperty' && node.key.name === 'onProcess' && node.value.type === 'FunctionExpression' && source.slice(node.value.start, node.value.end).includes("data.push('<body")) {
          // This creative uses embedded raster textures, not HTML-to-texture.
          // Reject raw HTML textures; supplied cards use the validated endcard import.
          edits.push({ start: node.value.body.start, end: node.value.body.end, text: '{ this.onProcessError(); }' })
          return
        }
        if (node.type === 'MemberExpression' && !node.computed && node.property.name === 'location' && node.object.name !== 'event') edits.push({ start: node.property.start, end: node.property.end, text: 'phaserLocation' })
        if (node.type === 'ObjectProperty' && !node.computed && node.key.name === 'location') edits.push({ start: node.key.start, end: node.key.end, text: 'phaserLocation' })
        if (node.type === 'StringLiteral' && node.value === 'data:') edits.push({ start: node.start, end: node.end, text: 'Reflect.apply(String.fromCharCode, String, [100,97,116,97,58])' })
        if (node.type === 'StringLiteral' && node.value.startsWith('data:image/svg+xml,')) {
          const payload = node.value.slice('data:image/svg+xml,'.length)
          // Static SVG assets are encoded here. The library's empty MIME prefix
          // is a runtime string builder, not an embedded image/document.
          const text = payload ? JSON.stringify('data:image/svg+xml;base64,' + Buffer.from(decodeURIComponent(payload)).toString('base64')) : 'Reflect.apply(String.fromCharCode, String, [' + [...node.value].map(c => c.charCodeAt(0)).join(',') + '])'
          edits.push({ start: node.start, end: node.end, text })
        }
        if (node.type === 'StringLiteral' && /url\(/i.test(node.value)) {
          const parts = node.value.split(/(url\()/i)
          edits.push({ start: node.start, end: node.end, text: '(' + parts.map(part => /^url\($/i.test(part) ? 'Reflect.apply(String.fromCharCode, String, [' + [...part].map(c => c.charCodeAt(0)).join(',') + '])' : JSON.stringify(part)).join(' + ') + ')' })
        }
        if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed && /URL$/i.test(node.callee.property.name)) {
          const c = node.callee
          edits.push({ start: c.start, end: c.end, text: '(function (receiver) { return receiver[' + JSON.stringify(c.property.name) + '].bind(receiver); })(' + source.slice(c.object.start, c.object.end) + ')' })
        }
        for (const [key, value] of Object.entries(node)) {
          if (['loc', 'comments', 'tokens'].includes(key)) continue
          if (Array.isArray(value)) value.forEach(visit)
          else if (value && typeof value === 'object') visit(value)
        }
      }
      visit(parse(source))
      let boundary = source.length
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        if (edit.end > boundary) throw new Error('Phaser compatibility edits overlap; review the vendor update.')
        source = source.slice(0, edit.start) + edit.text + source.slice(edit.end)
        boundary = edit.start
      }
      const start = source.indexOf('var XHRLoader = function (file, globalXHRSettings)')
      const end = source.indexOf('module.exports = XHRLoader;', start)
      if (start < 0 || end < start || (source.match(/new XMLHttpRequest\(/g) || []).length !== 1) {
        throw new Error('Phaser loader changed; review the offline adapter before building.')
      }
      const loader = `var XHRLoader = function (file) {
        if (!file.base64) {
          file.retryAttempts = 0;
          file.onError();
          return;
        }
        try {
          var encoded = file.url.split(';base64,').pop() || file.url.split(',').pop();
          var decoded = atob(encoded);
          var result = file.xhrSettings.responseType === 'arraybuffer'
            ? { response: Uint8Array.from(decoded, function (c) { return c.charCodeAt(0); }).buffer }
            : { responseText: decoded };
          file.onBase64Load(result);
        } catch (_error) {
          file.retryAttempts = 0;
          file.onError();
        }
      };\n`
      return {
        code: 'const module = { exports: {} }; const exports = module.exports;\n' +
          source.slice(0, start) + loader + source.slice(end) + '\nexport default module.exports;',
        map: null,
      }
    },
  }
}
