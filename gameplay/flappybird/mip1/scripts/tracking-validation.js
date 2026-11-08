// Shared by the outer export and decoded end-card validation.
export function validateTrackingNames(html) {
  for (const match of html.matchAll(/\bclickTag\b/gi)) {
    const before = html.slice(Math.max(0, match.index - 80), match.index)
    const after = html.slice(match.index + match[0].length).trimStart()
    if (match[0] !== 'clickTag' || !/\bwindow\s*\.\s*$/.test(before)) {
      throw new Error('Reserved tracking name: only a read of window.clickTag is permitted; rename bare/local aliases')
    }
    if (/^(?:(?:\?\?|\*\*|&&|\|\||[+\-*/%&|^])?=(?!=)|\+\+|--)/.test(after) ||
        /(?:\+\+|--|\bdelete)\s*window\s*\.\s*$/.test(before)) {
      throw new Error('Reserved tracking assignment: preserve the platform-injected window.clickTag')
    }
  }
}
