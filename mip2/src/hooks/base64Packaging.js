// Node-only Vite build plugin; import from vite.config.js, not React components.
import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";
import { parse as parseHtml } from "parse5";
import { parse as parseJs } from "@babel/parser";

export const MAX_BYTES = 5_000_000;
export const TARGET_BYTES = 4_900_000;
const formatMB = bytes => `${(bytes / 1_000_000).toFixed(3)} MB`;
const htmlDocument = /<!doctype\s+html|<html\b|<head\b|<body\b/i;
const mediaExtension = /\.(?:avif|png|jpe?g|gif|webp|svg|ico|mp3|wav|ogg|m4a|aac|mp4|webm|mov|woff2?|ttf|otf)(?:[?#].*)?$/i;
const mimeTypes = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf',
};
const namespaces = new Set([
  'http://www.w3.org/1999/xhtml', 'http://www.w3.org/2000/svg',
  'http://www.w3.org/1998/Math/MathML', 'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace', 'http://www.w3.org/2000/xmlns/',
]);
const fail = (message) => { throw new Error(`[creative packaging] ${message}`); };

function walk(node, visit) {
  if (node === null || node === undefined) return;
  visit(node);
  if (typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parentNode' || key === 'loc' || key === 'sourceCodeLocation') continue;
    if (Array.isArray(value)) value.forEach(child => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}

function editsTo(source, edits) {
  return edits.sort((a, b) => b.start - a.start).reduce(
    (text, edit) => text.slice(0, edit.start) + edit.value + text.slice(edit.end), source,
  );
}

export function decodeBase64(payload, label) {
  if (!payload || payload.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)) {
    fail(`${label}: invalid or empty Base64 payload`);
  }
  const bytes = Buffer.from(payload, 'base64');
  if (!bytes.length || bytes.toString('base64') !== payload) fail(`${label}: noncanonical Base64 payload`);
  return bytes;
}

function checkNavigation(text, label) {
  if (text.includes('window.' + 'open')) fail(`${label}: forbidden browser navigation`);
}

function property(node) {
  return node?.computed ? node.property?.value : node?.property?.name;
}

function inspectJs(code, label, inspectString) {
  checkNavigation(code, label);
  let tree;
  try { tree = parseJs(code, { sourceType: 'unambiguous', plugins: ['jsx'] }); }
  catch (error) { fail(`${label}: cannot validate JavaScript: ${error.message}`); }
  walk(tree, node => {
    if (node.type === 'StringLiteral') inspectString(node.value, node);
    if (node.type === 'TemplateElement') inspectString(node.value.cooked ?? node.value.raw, node);
    if (node.type === 'ImportDeclaration' && /\.html?(?:\?|$)/i.test(node.source.value) && !node.source.value.endsWith('?endcard')) {
      fail(`${label}: raw embedded HTML import; use .html?endcard for build-time encoding`);
    }
    if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
      const prop = property(node);
      if (prop === 'open' && ['window', 'self', 'globalThis', 'top', 'parent'].includes(node.object?.name)) {
        fail(`${label}: forbidden browser navigation`);
      }
    }
    if (node.type === 'AssignmentExpression' && /(?:^|\.)location(?:\.|$)/.test(memberPath(node.left))) {
      fail(`${label}: browser location navigation is forbidden`);
    }
    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      const callee = memberPath(node.callee);
      if (/(?:^|\.)mraid\.open$/.test(callee) && node.arguments.length === 0) {
        fail(`${label}: MRAID click-through requires a clickTarget argument`);
      }
      if (/(?:^|\.)(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|Worker|SharedWorker|importScripts)$/.test(callee) || /serviceWorker\.register$/.test(callee)) {
        fail(`${label}: runtime external-resource API ${callee} is forbidden`);
      }
      if (/^(?:(?:window|self|globalThis)\.)?(?:open|btoa)$/.test(callee) || /(?:^|\.)location\.(?:assign|replace)$/.test(callee)) {
        fail(`${label}: runtime HTML encoding or browser navigation is forbidden (${callee})`);
      }
    }
    if (node.type === 'ImportExpression' || node.callee?.type === 'Import') fail(`${label}: runtime imports are forbidden`);
  });
}

function memberPath(node) {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'MemberExpression') return `${memberPath(node.object)}.${property(node)}`;
  return '';
}

function dataReference(value, label, documents, depth) {
  if (depth > 8) fail(`${label}: excessive nested documents/assets`);
  const match = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([^#]*)(?:#.*)?$/i.exec(value);
  if (!match) fail(`${label}: assets must use nonempty Base64 data URLs`);
  const bytes = decodeBase64(match[2], label);
  const mime = match[1].toLowerCase();
  if (mime === 'text/html') {
    if (depth > 8) fail(`${label}: excessive nested documents`);
    const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!htmlDocument.test(html)) fail(`${label}: encoded end card is not an HTML document`);
    if (documents && documents.get(value) !== html) fail(`${label}: encoded end card does not match its build-time document`);
    validateHtml(html, { label: `${label} (decoded end card)`, depth: depth + 1 });
  } else if (mime === 'image/svg+xml') {
    validateHtml(new TextDecoder('utf-8', { fatal: true }).decode(bytes), { label: `${label} (decoded SVG)`, depth: depth + 1 });
  } else if (/^(?:text\/|application\/(?:javascript|json|xml))/.test(mime)) {
    fail(`${label}: unsupported embedded executable/text asset ${mime}`);
  }
}

function inspectValue(value, label, documents, depth) {
  checkNavigation(value, label);
  if (htmlDocument.test(value)) fail(`${label}: raw embedded HTML document; use .html?endcard`);
  if (value.startsWith('data:')) dataReference(value, label, documents, depth);
  else if (mediaExtension.test(value) || (/^(?:https?:|wss?:|\/\/)/i.test(value) && !namespaces.has(value))) {
    // React includes non-resource diagnostic links; resource attributes are checked separately.
    if (!value.startsWith('https://react.dev/errors/')) fail(`${label}: non-inlined resource ${value.slice(0, 120)}`);
  }
}

function validateCss(css, label, documents, depth) {
  if (/@import\b/i.test(css)) fail(`${label}: CSS imports must be inlined`);
  for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    const value = (match[1] ?? match[2] ?? match[3]).trim();
    if (!value.startsWith('#')) dataReference(value, label, documents, depth);
  }
  for (const match of css.matchAll(/(["'])(.*?)\1/g)) {
    if (!match[2].startsWith('#')) inspectValue(match[2], label, documents, depth);
  }
}

export function validateHtml(html, { label = 'creative', main = false, documents, depth = 0 } = {}) {
  checkNavigation(html, label);
  const tree = parseHtml(html, { sourceCodeLocationInfo: true });
  const scripts = [];
  walk(tree, node => {
    if (!node.tagName) return;
    const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
    if (node.tagName === 'script') {
      scripts.push(node);
      if (attrs.src && attrs.src !== 'mraid.js') fail(`${label}: script must be inlined: ${attrs.src}`);
      const code = node.childNodes?.map(child => child.value || '').join('') || '';
      if (!attrs.type || /^(?:module|(?:text|application)\/javascript)$/.test(attrs.type)) {
        if (code.trim()) inspectJs(code, label, value => inspectValue(value, label, documents, depth));
      } else if (code.trim()) {
        try { JSON.parse(code, (_key, value) => { if (typeof value === 'string') inspectValue(value, label, documents, depth); return value; }); }
        catch { fail(`${label}: unsupported script payload`); }
      }
    }
    if (node.tagName === 'base' || (node.tagName === 'meta' && attrs['http-equiv']?.toLowerCase() === 'refresh')) fail(`${label}: base/refresh navigation is forbidden`);
    if (node.tagName === 'style') validateCss(node.childNodes.map(child => child.value || '').join(''), label, documents, depth);
    for (const [name, value] of Object.entries(attrs)) {
      if (name === 'srcdoc') fail(`${label}: raw embedded HTML srcdoc; decode a build-time end-card import at runtime`);
      if (name === 'style') validateCss(value, label, documents, depth);
      if (name.startsWith('on')) inspectJs(value, label, item => inspectValue(item, label, documents, depth));
      if (['src', 'href', 'xlink:href', 'poster', 'data', 'action', 'formaction', 'background'].includes(name)) {
        if (node.tagName === 'script' && name === 'src' && value === 'mraid.js') continue;
        if (value.startsWith('#')) continue;
        dataReference(value, label, documents, depth);
      }
      if (name === 'srcset') {
        // A Base64 URL contains a comma; split on the comma AFTER each candidate.
        let rest = value.trim();
        while (rest) {
          const candidate = /^(data:[^;,\s]+;base64,[A-Za-z0-9+/=]+)(?:\s+[\d.]+[wx])?\s*(?:,\s*|$)/.exec(rest);
          if (!candidate) fail(`${label}: srcset must contain only inlined candidates`);
          dataReference(candidate[1], label, documents, depth);
          rest = rest.slice(candidate[0].length);
        }
        if (!value.trim()) fail(`${label}: empty srcset`);
      }
    }
  });
  if (main) {
    if (scripts[0]?.attrs.find(attr => attr.name === 'src')?.value !== 'mraid.js') fail(`${label}: mraid.js must remain the first script`);
    for (const required of ['window.__mip.openClickthrough = function handleMraidOpen()', 'window.isMraidUsable(mraid)', 'mraid.open(clickTarget)', 'mraid.getState() === "loading"']) {
      if (!html.includes(required)) fail(`${label}: required raw MRAID implementation missing: ${required}`);
    }
  }
}

export function validateOutput(html, documents) {
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > MAX_BYTES) {
    const largest = [...html.matchAll(/data:([^;,]+);base64,([A-Za-z0-9+/=]+)/g)]
      .map(match => ({ mime: match[1], bytes: Buffer.byteLength(match[0]) }))
      .sort((a, b) => b.bytes - a.bytes).slice(0, 5)
      .map(asset => `${asset.mime}: ${formatMB(asset.bytes)} encoded`).join('; ');
    fail(`final HTML is ${formatMB(bytes)} (${bytes} bytes); limit is ${formatMB(MAX_BYTES)} (${MAX_BYTES} bytes). Preserve originals, optimize the largest media, and rebuild to <= ${formatMB(TARGET_BYTES)}. Largest payloads: ${largest || 'no media payloads'}`);
  }
  validateHtml(html, { label: 'final HTML', main: true, documents });
  return bytes;
}

async function mediaUrl(file, watch) {
  watch(file);
  const mime = mimeTypes[path.extname(file).toLowerCase()];
  if (!mime) fail(`unsupported media type: ${file}`);
  const bytes = await fs.readFile(file);
  if (!bytes.length) fail(`empty asset: ${file}`);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

function base64SvgUrls(text) {
  const convert = value => `data:image/svg+xml;base64,${Buffer.from(decodeURIComponent(value.slice(value.indexOf(',') + 1))).toString('base64')}`;
  return text.replace(/(["'])(data:image\/svg\+xml,[\s\S]*?)\1/gi, (_match, quote, value) => `${quote}${convert(value)}${quote}`)
    .replace(/data:image\/svg\+xml,[^\s)"'<>]+/gi, convert);
}

// Usage: import endCardHtml from './endcard.html?endcard';
// Feed endCardHtml to the existing iframe's srcDoc. The generated module holds
// only Base64 and decodes UTF-8 at runtime; the source document stays editable.
export async function packageEndCard(file, watch = () => {}) {
  watch(file);
  const source = await fs.readFile(file, 'utf8');
  const edits = [];
  const pending = [];
  const local = value => {
    if (/^(?:[a-z]+:|\/\/|\/)/i.test(value)) fail(`${file}: end-card assets must be local relative files or Base64: ${value.slice(0, 100)}`);
    return path.resolve(path.dirname(file), decodeURIComponent(value.split(/[?#]/)[0]));
  };
  const inlineUrl = async value => value.startsWith('data:') || value.startsWith('#') ? value : mediaUrl(local(value), watch);
  const tree = parseHtml(source, { sourceCodeLocationInfo: true });
  walk(tree, node => {
    if (!node.tagName) return;
    if (node.tagName === 'script' && !node.attrs.some(attr => attr.name === 'src')) {
      const location = node.sourceCodeLocation;
      const scriptType = node.attrs.find(attr => attr.name === 'type')?.value;
      if (location?.endTag && (!scriptType || /^(?:module|(?:text|application)\/javascript)$/.test(scriptType))) {
        const script = source.slice(location.startTag.endOffset, location.endTag.startOffset);
        inspectJs(script, file, (value, literal) => {
          if (!value.startsWith('data:') && mediaExtension.test(value)) {
            if (literal.type !== 'StringLiteral') fail(`${file}: use a static string for end-card media references`);
            pending.push(inlineUrl(value).then(url => edits.push({ start: location.startTag.endOffset + literal.start, end: location.startTag.endOffset + literal.end, value: JSON.stringify(url) })));
          }
        });
      }
    }
    for (const attr of node.attrs || []) {
      if (!['src', 'href', 'poster', 'background', 'xlink:href'].includes(attr.name)) continue;
      if (node.tagName === 'script' && attr.value === 'mraid.js') continue;
      if (attr.value.startsWith('data:') || attr.value.startsWith('#')) continue;
      const location = node.sourceCodeLocation?.attrs?.[attr.name];
      if (!location) continue;
      // Supplied HTML must already contain its own scripts/styles. Never silently
      // alter script execution order or stylesheet semantics during packaging.
      if (node.tagName === 'script' || node.tagName === 'link') fail(`${file}: inline end-card scripts/styles before packaging`);
      pending.push(inlineUrl(attr.value).then(value => edits.push({ start: location.startOffset, end: location.endOffset, value: `${attr.name}="${value}"` })));
    }
  });
  // CSS asset references are safe to replace without reserializing the document.
  for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    const value = (match[1] ?? match[2] ?? match[3]).trim();
    if (!value.startsWith('data:') && !value.startsWith('#')) pending.push(inlineUrl(value).then(url => edits.push({ start: match.index, end: match.index + match[0].length, value: `url('${url}')` })));
  }
  await Promise.all(pending);
  const html = base64SvgUrls(editsTo(source, edits));
  validateHtml(html, { label: file });
  const url = `data:text/html;base64,${Buffer.from(html).toString('base64')}`;
  if (decodeBase64(url.split(',')[1], file).toString('utf8') !== html) fail(`${file}: end-card round-trip mismatch`);
  return { html, url };
}

export function base64Packaging() {
  const documents = new Map();
  let config;
  let rawScripts;
  return [
    {
      name: 'creative-base64-input',
      enforce: 'pre',
      configResolved(resolved) { config = resolved; },
      async buildStart() {
        documents.clear();
        const shell = await fs.readFile(path.join(config.root, 'index.html'), 'utf8');
        rawScripts = [...shell.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
      },
      async load(id) {
        const [file, query = ''] = id.split('?');
        if (config.command === 'build' && mediaExtension.test(file) && /(?:^|&)(?:raw|no-inline|noinline)(?:&|$)/.test(query)) {
          fail(`${file}: multimedia must be Base64-inlined; raw/external media imports are forbidden`);
        }
        if (/\.html?$/i.test(file)) {
          if (query !== 'endcard') {
            if (query) fail(`${file}: raw embedded HTML import; use .html?endcard`);
            return null; // Vite owns the main shell.
          }
          const { html, url } = await packageEndCard(file, dependency => this.addWatchFile(dependency));
          documents.set(url, html);
          return `const packaged=${JSON.stringify(url)};export default new TextDecoder().decode(Uint8Array.from(atob(packaged.slice(packaged.indexOf(',')+1)),c=>c.charCodeAt(0)));`;
        }
        // Vite may otherwise percent-encode SVG imports; force genuine Base64.
        if (config.command === 'build' && /\.svg$/i.test(file) && !query.includes('raw')) {
          return `export default ${JSON.stringify(await mediaUrl(file, dependency => this.addWatchFile(dependency)))};`;
        }
      },
      transform(code, id) {
        if (config.command !== 'build' || id.startsWith('\0') || id.includes('node_modules') || !/\.[cm]?[jt]sx?(?:\?|$)/.test(id)) return;
        inspectJs(code, id, value => {
          // Imports are resolved by Vite; final output checks their URLs.
          checkNavigation(value, id);
          if (htmlDocument.test(value)) fail(`${id}: raw embedded HTML document; use .html?endcard`);
        });
      },
    },
    {
      name: 'creative-final-validation',
      apply: 'build',
      enforce: 'post',
      generateBundle: {
        order: 'post',
        handler(_options, bundle) {
          if (Object.keys(bundle).length !== 1 || !bundle['index.html']) fail('production output must be exactly one self-contained index.html');
          const output = bundle['index.html'];
          // Vite's CSS/HTML SVG optimization uses percent encoding. Convert it
          // before validation; other non-Base64 assets remain errors.
          output.source = base64SvgUrls(String(output.source));
          const html = output.source;
          for (const script of rawScripts) if (!html.includes(script)) fail('validator-visible raw MRAID scripts changed during bundling');
          const bytes = validateOutput(html, documents);
          this.info(`Validated ${formatMB(bytes)} / ${formatMB(MAX_BYTES)} maximum; ${documents.size} encoded end-card document(s).`);
          if (bytes > TARGET_BYTES) this.warn(`Optimize media toward ${formatMB(TARGET_BYTES)} for delivery headroom; current size is ${formatMB(bytes)}.`);
        },
      },
      async writeBundle() {
        const directory = path.resolve(config.root, config.build.outDir);
        const files = await fs.readdir(directory);
        if (files.length !== 1 || files[0] !== 'index.html') fail('output directory contains external files; remove public assets or import them for inlining');
        const html = await fs.readFile(path.join(directory, 'index.html'), 'utf8');
        for (const script of rawScripts) if (!html.includes(script)) fail('written output changed the raw MRAID scripts');
        const bytes = validateOutput(html, documents);
        if ((await fs.stat(path.join(directory, 'index.html'))).size !== bytes) fail('written file byte count differs from the validated output');
        this.info(`Verified written index.html: ${formatMB(bytes)}.`);
      },
    },
  ];
}
