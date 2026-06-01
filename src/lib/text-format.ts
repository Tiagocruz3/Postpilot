/**
 * Replace em/en/figure dashes and horizontal bars with a plain hyphen so AI
 * generated copy never contains em dashes. Surrounding spacing is preserved,
 * so " - " becomes " - " and "word - word" becomes "word-word".
 */
export function normalizeDashes(text: string): string {
  if (!text) return text
  return text.replace(/[\u2012\u2013\u2014\u2015]/g, '-')
}
