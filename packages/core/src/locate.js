/**
 * Source locations for JSON text (docs/specs/validation-and-coverage.md#source-locations).
 *
 * `JSON.parse` forgets where anything was, so LOAD scans the same text once more
 * and keeps, for every object key that can name a token or a group, the
 * 1-based line and column of its opening quote. Zero-dependency, single pass,
 * deterministic. It is only run on text `JSON.parse` already accepted, so it may
 * assume well-formed JSON and never throws on it.
 */

/** @returns {{ line: number, column: number }} 1-based, for a character offset. */
export function lineColumnOf(text, offset) {
  let line = 1;
  let lineStart = 0;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) { line++; lineStart = i + 1; }
  }
  return { line, column: offset - lineStart + 1 };
}

/**
 * Map of dotted key path -> { line, column } for every object key reachable
 * through objects only (a key inside an array has no token path). `$`-prefixed
 * keys (`$value`, `$extensions`…) are not recorded: they are not token names.
 */
export function locateJson(text) {
  const positions = new Map();
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  const at = (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - starts[lo] + 1 };
  };

  let i = 0;
  const skipWs = () => { while (i < text.length && ' \t\n\r﻿'.includes(text[i])) i++; };
  const readString = () => {
    const begin = i;
    i++; // opening quote
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    i++; // closing quote
    return { raw: text.slice(begin, i), begin };
  };
  const readValue = (path) => {
    skipWs();
    const c = text[i];
    if (c === '{') {
      i++;
      skipWs();
      if (text[i] === '}') { i++; return; }
      for (;;) {
        skipWs();
        const { raw, begin } = readString();
        let key;
        try { key = JSON.parse(raw); } catch { key = raw.slice(1, -1); }
        skipWs();
        i++; // ':'
        const recorded = path !== null && !key.startsWith('$');
        const child = recorded ? [...path, key] : null;
        if (recorded) positions.set(child.join('.'), at(begin));
        readValue(child);
        skipWs();
        if (text[i] === ',') { i++; continue; }
        i++; // '}'
        return;
      }
    }
    if (c === '[') {
      i++;
      skipWs();
      if (text[i] === ']') { i++; return; }
      for (;;) {
        readValue(null);
        skipWs();
        if (text[i] === ',') { i++; continue; }
        i++; // ']'
        return;
      }
    }
    if (c === '"') { readString(); return; }
    while (i < text.length && !',]} \t\n\r'.includes(text[i])) i++; // number, true, false, null
  };
  readValue([]);
  return positions;
}

/** Line and column of the offset a `JSON.parse` message names ("… at position 12"), or null. */
export function parseErrorLocation(text, message) {
  const m = /position (\d+)/.exec(message);
  return m ? lineColumnOf(text, Number(m[1])) : null;
}
