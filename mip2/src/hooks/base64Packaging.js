// Node-only Vite build plugin; import from vite.config.js, not React components.
import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";
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
const calendarModule = path.join(path.dirname(fileURLToPath(import.meta.url)), 'calendarClock.js').replaceAll('\\', '/');

// Only explicit calendar consumers may use preview time. Never replace Date
// globally: media, input timestamps, and elapsed timers must remain real-time.
function calendarEdits(code, label) {
  const edits = [];
  let usesCalendar = false;
  const tree = parseJs(code, { sourceType: 'unambiguous', allowReturnOutsideFunction: true });
  const freshDate = node => node?.type === 'NewExpression' && memberPath(node.callee) === 'Date' && node.arguments.length === 0;
  const timestamp = node => node?.type === 'CallExpression' && node.arguments.length === 0 &&
    (memberPath(node.callee) === 'Date.now' ||
      (property(node.callee) === 'getTime' && freshDate(node.callee.object)));
  const replace = (node, value) => {
    usesCalendar = true;
    edits.push({ start: node.start, end: node.end, value });
  };
  walk(tree, node => {
    if (node.type === 'MemberExpression' && memberPath(node) === 'window.__mip.calendarClock') usesCalendar = true;
    if (node.type !== 'CallExpression') return;
    const method = property(node.callee);
    if (['toLocaleDateString', 'toDateString', 'getFullYear', 'getMonth', 'getDate', 'getDay'].includes(method) && freshDate(node.callee.object)) {
      replace(node.callee.object, 'window.__mip.calendarClock.now()');
    }
    if (memberPath(node.callee) === 'resolveSipEffectiveDate') {
      const base = node.arguments[0];
      if (timestamp(base)) replace(base, 'window.__mip.calendarClock.now().getTime()');
      else if (!code.slice(base?.start, base?.end).includes('calendarClock')) {
        fail(`${label}: SIP calendar base needs review; pass window.__mip.calendarClock.now().getTime() to resolveSipEffectiveDate. Elapsed timers must retain real time.`);
      }
    }
    const formatter = node.callee.object;
    if (method === 'format' && ['NewExpression', 'CallExpression'].includes(formatter?.type) &&
      memberPath(formatter.callee) === 'Intl.DateTimeFormat' && freshDate(node.arguments[0])) {
      const options = formatter.arguments[1];
      const fields = options?.type === 'ObjectExpression' ? options.properties.map(item => item.key?.name ?? item.key?.value) : [];
      // An explicit calendar-only format is safe; mixed clock-time formats
      // need source review because the preview anchor is local noon.
      if ((!options || fields.some(field => ['dateStyle', 'year', 'month', 'day', 'weekday'].includes(field))) &&
        !fields.some(field => ['timeStyle', 'hour', 'minute', 'second', 'timeZone'].includes(field))) {
        replace(node.arguments[0], 'window.__mip.calendarClock.now()');
      }
    }
    // A date stored in a variable or passed to an arbitrary formatter cannot
    // safely be classified as calendar-only without inspecting its consumers.
  });
  return { edits, usesCalendar };
}

function prepareEndCardCalendar(source, label) {
  const edits = [];
  let usesCalendar = false;
  let insertion;
  walk(parseHtml(source, { sourceCodeLocationInfo: true }), node => {
    const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
    const location = node.sourceCodeLocation;
    if (node.tagName !== 'script' || attrs.src || !location?.endTag ||
      (attrs.type && !/^(?:module|(?:text|application)\/javascript)$/.test(attrs.type))) return;
    const start = location.startTag.endOffset;
    const code = source.slice(start, location.endTag.startOffset);
    const result = calendarEdits(code, label);
    usesCalendar ||= result.usesCalendar;
    insertion ??= location.startOffset;
    for (const edit of result.edits) edits.push({ ...edit, start: start + edit.start, end: start + edit.end });
  });
  if (usesCalendar) {
    edits.push({ start: insertion, end: insertion, value: '<script>window.__mip=window.__mip||{};window.__mip.calendarClock=window.parent.__mip.calendarClock;</script>' });
  }
  return { source: editsTo(source, edits), usesCalendar };
}

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
  if (/clickTag1|click[-_]?through/i.test(text)) {
    fail(`${label}: reserved tracking name; use only the injected window.clickTag and neutral helper names such as openDestination`);
  }
}

function property(node) {
  return node?.computed ? node.property?.value : node?.property?.name;
}

function inspectJs(code, label, inspectString, inlineHandler = false, sourceType = 'unambiguous', main = false) {
  checkNavigation(code, label);
  let tree;
  try { tree = parseJs(code, { sourceType, plugins: ['jsx'], allowReturnOutsideFunction: inlineHandler }); }
  catch (error) { fail(`${label}: cannot validate JavaScript: ${error.message}`); }
  // Navigation destinations are not media requests. Preserve supplied URL
  // literals in MRAID arguments and destination variables.
  const destinations = new WeakSet();
  const markDestination = node => {
    if (node?.type === 'StringLiteral' || node?.type === 'TemplateElement') destinations.add(node);
    if (node?.type === 'TemplateLiteral') node.quasis.forEach(markDestination);
    if (node?.type === 'LogicalExpression') { markDestination(node.left); markDestination(node.right); }
    if (node?.type === 'ConditionalExpression') { markDestination(node.consequent); markDestination(node.alternate); }
  };
  walk(tree, node => {
    if (main && (
      (['AssignmentExpression', 'UpdateExpression'].includes(node.type) && /^(?:(?:window|self|globalThis)\.)?clickTag$/.test(memberPath(node.left ?? node.argument))) ||
      (node.type === 'VariableDeclarator' && node.id?.name === 'clickTag')
    )) fail(`${label}: the main creative must not declare or overwrite the platform-injected window.clickTag`);
    if (node.type === 'AssignmentExpression' && /^(?:(?:window|self|globalThis)\.)?(?:clickTag|clickTarget|destinationUrl)$/.test(memberPath(node.left))) markDestination(node.right);
    if (node.type === 'VariableDeclarator' && /^(?:clickTag|clickTarget|destinationUrl)$/.test(node.id?.name)) markDestination(node.init);
    if (node.type === 'StringLiteral') inspectString(node.value, node, destinations.has(node));
    if (node.type === 'TemplateElement') inspectString(node.value.cooked ?? node.value.raw, node, destinations.has(node));
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
      if (/(?:^|\.)mraid\.open$/.test(callee)) markDestination(node.arguments[0]);
      if (/(?:^|\.)mraid\.open$/.test(callee) && node.arguments.length === 0) {
        fail(`${label}: MRAID navigation requires an explicit destination argument`);
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

function inspectValue(value, label, documents, depth, destination = false) {
  checkNavigation(value, label);
  if (htmlDocument.test(value)) fail(`${label}: raw embedded HTML document; use .html?endcard`);
  if (!destination && value.length >= 16 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    // Inspect plain encoded HTML constants too, without interpreting binary media.
    const decoded = Buffer.from(value, 'base64');
    if (htmlDocument.test(decoded.toString('utf8'))) {
      dataReference(`data:text/html;base64,${value}`, label, documents, depth);
    }
  }
  if (value.startsWith('data:')) dataReference(value, label, documents, depth);
  else if (!destination && (mediaExtension.test(value) || (/^(?:https?:|wss?:|\/\/)/i.test(value) && !namespaces.has(value)))) {
    // React includes non-resource diagnostic links; resource attributes are checked separately.
    if (!value.startsWith('https://react.dev/errors/')) fail(`${label}: non-inlined resource ${value.slice(0, 120)}`);
  }
}

function validateUrlTokens(text, label, documents, depth) {
  // Match the host checker's case-insensitive scan, including JavaScript,
  // comments, and strings. A URL constructor call can be mistaken for CSS.
  for (const match of text.matchAll(/url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    const value = (match[1] ?? match[2] ?? match[3]).trim();
    if (!value.startsWith('#') && !value.startsWith('data:')) {
      fail(`${label}: non-inlined CSS-style URL token: ${match[0].slice(0, 120)}. For JavaScript URL construction, use Reflect.construct(URL, [value]) to avoid the host's CSS scan; media must still be Base64-inlined.`);
    }
    if (!value.startsWith('#')) dataReference(value, label, documents, depth);
  }
}

function validateCss(css, label, documents, depth) {
  if (/@import\b/i.test(css)) fail(`${label}: CSS imports must be inlined`);
  validateUrlTokens(css, label, documents, depth);
  for (const match of css.matchAll(/(["'])(.*?)\1/g)) {
    if (!match[2].startsWith('#')) inspectValue(match[2], label, documents, depth);
  }
}

export function validateHtml(html, { label = 'creative', main = false, documents, depth = 0 } = {}) {
  checkNavigation(html, label);
  validateUrlTokens(html, label, documents, depth);
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
        if (code.trim()) {
          inspectJs(code, label, (value, _node, destination) => inspectValue(value, label, documents, depth, destination), false, attrs.type === 'module' ? 'module' : 'script', main);
          if (calendarEdits(code, label).edits.length) fail(`${label}: calendar content bypasses the shared preview clock; use window.__mip.calendarClock.now() (or import the shared singleton in gameplay).`);
        }
      } else if (code.trim()) {
        let payload;
        try { payload = JSON.parse(code); }
        catch { fail(`${label}: unsupported script payload`); }
        const inspectJson = (value, field = '') => {
          if (typeof value === 'string') {
            // SIP builder labels describe the original uploaded files; they
            // are not runtime resource URLs. Actual assets remain validated.
            const fileLabel = attrs.id === 'sip-builder-config' && attrs.type === 'application/json'
              && /^(?:videos\.(?:portrait|landscape)\.name|dynamicTexts\.\d+\.font\.fileName)$/.test(field)
              && !/[\\/:]/.test(value) && mediaExtension.test(value);
            inspectValue(value, `${label} (${field})`, documents, depth, fileLabel);
          } else if (value && typeof value === 'object') {
            for (const [key, item] of Object.entries(value)) inspectJson(item, field ? `${field}.${key}` : key);
          }
        };
        inspectJson(payload);
      }
    }
    if (node.tagName === 'base' || (node.tagName === 'meta' && attrs['http-equiv']?.toLowerCase() === 'refresh')) fail(`${label}: base/refresh navigation is forbidden`);
    if (node.tagName === 'style') validateCss(node.childNodes.map(child => child.value || '').join(''), label, documents, depth);
    for (const [name, value] of Object.entries(attrs)) {
      if (name === 'srcdoc') fail(`${label}: raw embedded HTML srcdoc; decode a build-time end-card import at runtime`);
      if (name === 'style') validateCss(value, label, documents, depth);
      if (name.startsWith('on')) inspectJs(value, label, (item, _node, destination) => inspectValue(item, label, documents, depth, destination), true, 'script', main);
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
    for (const required of ['window.__mip.openDestination = function handleMraidOpen()', 'window.isMraidUsable(mraid)', 'mraid.open(destinationUrl)', 'mraid.getState() === "loading"']) {
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

// Compatibility changes apply only to imported end cards, before inspection.
// Edit source ranges rather than reserializing the document or replacing text
// inside JavaScript strings/comments. Never write these changes back to disk.
function compatibleEndCard(source, label) {
  const edits = [];
  const correctCalls = (code, inlineHandler = false) => {
    let tree;
    try {
      tree = parseJs(code, { sourceType: 'unambiguous', allowReturnOutsideFunction: inlineHandler });
    } catch (error) {
      fail(`${label}: cannot parse end-card JavaScript: ${error.message}`);
    }
    const calls = [];
    walk(tree, node => {
      if (node.type === 'CallExpression' && /(?:^|\.)mraid\.open$/.test(memberPath(node.callee)) && node.arguments.length === 0) {
        calls.push({ start: node.end - 1, end: node.end - 1, value: '""' });
      }
    });
    return editsTo(code, calls);
  };
  walk(parseHtml(source, { sourceCodeLocationInfo: true }), node => {
    if (!node.tagName) return;
    const location = node.sourceCodeLocation;
    if (node.tagName === 'source' && node.parentNode?.tagName === 'video') {
      const emptySrc = node.attrs.find(attr => attr.name === 'src' && attr.value === '');
      const range = location?.attrs?.src;
      if (emptySrc && range) edits.push({ start: range.startOffset, end: range.endOffset, value: '' });
    }
    if (node.tagName === 'script' && location?.endTag) {
      const attrs = Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value]));
      if (!Object.hasOwn(attrs, 'src') && (!attrs.type || /^(?:module|(?:text|application)\/javascript)$/.test(attrs.type))) {
        const start = location.startTag.endOffset;
        const end = location.endTag.startOffset;
        const code = source.slice(start, end);
        const corrected = correctCalls(code);
        if (corrected !== code) edits.push({ start, end, value: corrected });
      }
    }
    for (const attr of node.attrs) {
      if (!attr.name.startsWith('on')) continue;
      const range = location?.attrs?.[attr.name];
      if (!range) continue;
      const corrected = correctCalls(attr.value, true);
      if (corrected !== attr.value) {
        const encoded = corrected.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
        edits.push({ start: range.startOffset, end: range.endOffset, value: `${attr.name}="${encoded}"` });
      }
    }
  });
  return editsTo(source, edits);
}

// Usage: import endCardHtml from './endcard.html?endcard';
// Feed endCardHtml to the existing iframe's srcDoc. The generated module holds
// only Base64 and decodes UTF-8 at runtime; the source document stays editable.
export async function packageEndCard(file, watch = () => {}) {
  watch(file);
  const { source, usesCalendar } = prepareEndCardCalendar(compatibleEndCard(await fs.readFile(file, 'utf8'), file), file);
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
        inspectJs(script, file, (value, literal, destination) => {
          if (!destination && !value.startsWith('data:') && mediaExtension.test(value)) {
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
  return { html, url, usesCalendar };
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
          const { html, url, usesCalendar } = await packageEndCard(file, dependency => this.addWatchFile(dependency));
          documents.set(url, html);
          const calendar = usesCalendar ? `import {calendarClock} from ${JSON.stringify(calendarModule)};window.__mip=window.__mip||{};window.__mip.calendarClock=calendarClock;` : '';
          return `${calendar}const packaged=${JSON.stringify(url)};export default new TextDecoder().decode(Uint8Array.from(atob(packaged.slice(packaged.indexOf(',')+1)),c=>c.charCodeAt(0)));`;
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
