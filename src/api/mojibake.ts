// Shared UTF-8 "mojibake" repair.
//
// The backend serves text where UTF-8 was decoded as Latin-1 (e.g. "Rendición"
// arrives as "RendiciÃ³n"), sometimes double-encoded. Until that is fixed at the
// source, the client repairs it here.
//
// The repair re-decodes ONLY the maximal runs of Latin-1-range characters
// (<= 0xFF), leaving genuine Unicode (smart quotes, em-dash, bullets, emoji,
// etc.) untouched. A previous implementation re-decoded the whole string via
// `charCodeAt(0) & 0xff`, which truncated and destroyed any legitimate
// non-Latin-1 character that shared a string with mojibake — common in free
// text pasted from Word.

function looksLikeMojibake(value: string): boolean {
  return /[ÃÂ][-ÿ]/.test(value)
}

function countReplacementChars(value: string): number {
  let count = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) === 0xfffd) {
      count += 1
    }
  }
  return count
}

function fixMojibakeOnce(value: string): string {
  let result = ''
  let index = 0
  while (index < value.length) {
    if (value.charCodeAt(index) <= 0xff) {
      let end = index
      const bytes: number[] = []
      while (end < value.length && value.charCodeAt(end) <= 0xff) {
        bytes.push(value.charCodeAt(end) & 0xff)
        end += 1
      }
      const run = value.slice(index, end)
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(
        Uint8Array.from(bytes),
      )
      // Only accept the re-decode if it did not introduce new replacement
      // characters (i.e. the run really was UTF-8 bytes, not lone bytes).
      const introducesGarbage =
        countReplacementChars(decoded) > countReplacementChars(run)
      result += introducesGarbage ? run : decoded
      index = end
    } else {
      result += value[index]
      index += 1
    }
  }
  return result
}

/**
 * Repairs UTF-8-decoded-as-Latin-1 text. Safe to call on already-correct
 * strings (returns them unchanged). Iterates to recover double-encoded content.
 */
export function fixMojibake(value: string): string {
  if (!looksLikeMojibake(value)) {
    return value
  }
  try {
    let current = value
    for (let pass = 0; pass < 3 && looksLikeMojibake(current); pass += 1) {
      const next = fixMojibakeOnce(current)
      if (next === current) {
        break
      }
      current = next
    }
    return current
  } catch {
    return value
  }
}
