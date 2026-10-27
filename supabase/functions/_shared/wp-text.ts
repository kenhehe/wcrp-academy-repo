// WordPress sends titles as HTML (title.rendered): '&#038;' for '&', '&#8211;' for '–',
// '&#8220;…&#8221;' for quotes. Shared by the sync (Deno) and lib/wordpress/mapper.ts, with no
// imports so both runtimes can load it; tests in wp-text.test.ts.

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', aacute: 'á', agrave: 'à', iacute: 'í',
  oacute: 'ó', uacute: 'ú', ntilde: 'ñ', ccedil: 'ç', ouml: 'ö', uuml: 'ü', auml: 'ä',
  oslash: 'ø', aring: 'å', szlig: 'ß', deg: '°', middot: '·',
}

// Numeric and common named entities → characters; an unknown name stays as written
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole
    }
    return NAMED[code.toLowerCase()] ?? whole
  })
}

// A rendered WordPress title as plain text: tags removed, entities decoded, spaces tidied
export function wpTitleText(rendered: string | null | undefined): string {
  return decodeEntities(String(rendered ?? '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}
