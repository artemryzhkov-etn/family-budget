/**
 * Tiny safe calculator for amount fields: + - * / and parentheses,
 * comma or dot decimals, spaces ignored. No eval().
 * Returns null for invalid/incomplete expressions or non-positive results.
 */
export function evalAmount(raw: string): number | null {
  const s = raw.replace(/,/g, '.').replace(/\s+/g, '');
  if (!s || !/^[\d.+\-*/()]+$/.test(s)) return null;

  let pos = 0;

  function parseExpr(): number {
    let v = parseTerm();
    while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
      const op = s[pos++];
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }

  function parseTerm(): number {
    let v = parseFactor();
    while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
      const op = s[pos++];
      const r = parseFactor();
      if (op === '/') {
        if (r === 0) throw new Error('div0');
        v = v / r;
      } else {
        v = v * r;
      }
    }
    return v;
  }

  function parseFactor(): number {
    if (s[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (s[pos] === '(') {
      pos++;
      const v = parseExpr();
      if (s[pos] !== ')') throw new Error('paren');
      pos++;
      return v;
    }
    const m = /^\d+(\.\d+)?|^\.\d+/.exec(s.slice(pos));
    if (!m) throw new Error('num');
    pos += m[0].length;
    return Number(m[0]);
  }

  try {
    const v = parseExpr();
    if (pos !== s.length || !Number.isFinite(v)) return null;
    const rounded = Math.round(v * 100) / 100;
    return rounded > 0 ? rounded : null;
  } catch {
    return null;
  }
}

/** True when the string is an expression (has operators), not just a number. */
export function isExpression(raw: string): boolean {
  const s = raw.replace(/,/g, '.').replace(/\s+/g, '');
  return /[+*/()]/.test(s) || /.-/.test(s.slice(1));
}
