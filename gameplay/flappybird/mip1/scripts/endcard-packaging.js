import { base64Packaging, validateHtml } from '../src/hooks/base64Packaging.js';
export function validateEndCard(html) { return validateHtml(html, { label: 'Phaser end card' }); }
export function endcardImport() { return base64Packaging()[0]; }
