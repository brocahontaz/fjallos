const ANSI_CLASSES: Record<string, string> = {
  '1': 'ansi-bold',
  '2': 'ansi-dim',
  '3': 'ansi-italic',
  '4': 'ansi-underline',
  '30': 'ansi-black',
  '31': 'ansi-red',
  '32': 'ansi-green',
  '33': 'ansi-yellow',
  '34': 'ansi-blue',
  '35': 'ansi-magenta',
  '36': 'ansi-cyan',
  '37': 'ansi-white',
  '90': 'ansi-bright-black',
  '91': 'ansi-bright-red',
  '92': 'ansi-bright-green',
  '93': 'ansi-bright-yellow',
  '94': 'ansi-bright-blue',
  '95': 'ansi-bright-magenta',
  '96': 'ansi-bright-cyan',
  '97': 'ansi-bright-white',
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Convert ANSI escape sequences to HTML <span> elements with CSS classes.
 * Text content is HTML-escaped before processing, so user input is safe.
 */
export function ansiToHtml(text: string): string {
  if (!text) return ''

  // Split on ANSI escape sequences, keeping the separators
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ESC char is intentional for ANSI parsing
  const parts = text.split(/(\x1b\[[0-9;]*m)/)
  const result: string[] = []
  let openSpans = 0

  for (const part of parts) {
    if (part.startsWith('\x1b[')) {
      const codes = part.slice(2, -1).split(';').filter(Boolean)

      // Reset code or empty (ESC[m = reset)
      if (!codes.length || codes.includes('0')) {
        result.push('</span>'.repeat(openSpans))
        openSpans = 0
        continue
      }

      const classes = codes
        .map((c) => ANSI_CLASSES[c])
        .filter(Boolean)
        .join(' ')

      if (classes) {
        result.push(`<span class="${classes}">`)
        openSpans++
      }
    } else {
      result.push(escapeHtml(part))
    }
  }

  // Close any unclosed spans
  result.push('</span>'.repeat(openSpans))

  return result.join('')
}
