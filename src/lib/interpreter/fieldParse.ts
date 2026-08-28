import {
  PAN_REGEX,
  AADHAAR_REGEX,
  normalizeAadhaar,
} from "@/lib/replica/mockApi";
import { extractEntities } from "@/lib/intent/mockIntent";

/**
 * Robust parsing of PAN / Aadhaar from *spoken* input.
 *
 * When a user spells a code aloud, speech-to-text turns the letter and number
 * names into words — often in Hinglish ("G" -> "ji", "2" -> "do", "3" -> "teen").
 * These helpers map those spoken tokens back to characters and fit them to the
 * field's fixed format, so "A B C D ji one two three four F" -> "ABCDG1234F".
 */

const LETTER_MAP: Record<string, string> = {
  a: "A", ay: "A", aye: "A", alpha: "A",
  b: "B", be: "B", bee: "B", bravo: "B",
  c: "C", see: "C", sea: "C", cee: "C", charlie: "C",
  d: "D", dee: "D", delta: "D",
  e: "E", ee: "E", echo: "E",
  f: "F", ef: "F", eff: "F", foxtrot: "F",
  g: "G", gee: "G", jee: "G", ji: "G", golf: "G",
  h: "H", aitch: "H", hotel: "H",
  i: "I", eye: "I", ai: "I", india: "I",
  j: "J", jay: "J", juliet: "J",
  k: "K", kay: "K", kilo: "K",
  l: "L", el: "L", ell: "L", lima: "L",
  m: "M", em: "M", mike: "M",
  n: "N", en: "N", november: "N",
  p: "P", pee: "P", pea: "P", papa: "P",
  q: "Q", queue: "Q", cue: "Q", kyu: "Q", quebec: "Q",
  r: "R", are: "R", ar: "R", romeo: "R",
  s: "S", es: "S", ess: "S", sierra: "S",
  t: "T", tee: "T", tea: "T", tango: "T",
  u: "U", you: "U", yu: "U", uniform: "U",
  v: "V", vee: "V", victor: "V",
  w: "W", doubleyou: "W", whiskey: "W",
  x: "X", ex: "X", xray: "X", "x-ray": "X",
  y: "Y", why: "Y", wai: "Y", yankee: "Y",
  z: "Z", zee: "Z", zed: "Z", zulu: "Z",
};

const DIGIT_MAP: Record<string, string> = {
  zero: "0", o: "0", oh: "0",
  one: "1", ek: "1",
  two: "2", to: "2", too: "2", do: "2",
  three: "3", teen: "3", tree: "3",
  four: "4", for: "4", char: "4", chaar: "4",
  five: "5", paanch: "5", panch: "5",
  six: "6", chhe: "6", che: "6", chah: "6", chhah: "6",
  seven: "7", saat: "7", sat: "7",
  eight: "8", ate: "8", aath: "8", aat: "8",
  nine: "9", nau: "9",
};

// Common filler words to ignore when a glued alpha run appears (so "number",
// "card", "correct" aren't expanded letter-by-letter).
const STOPWORDS = new Set([
  "is", "it", "its", "the", "my", "a", "an", "and", "please", "hai", "he",
  "mera", "meri", "mere", "number", "pan", "pancard", "aadhaar", "aadhar",
  "adhaar", "adhar", "card", "hoon", "hu", "hun", "wala", "correct", "change",
  "new", "old", "wrong", "yes", "no", "of", "this", "that", "your", "kar",
  "karo", "kardo", "actually", "wait", "matlab", "yeah", "okay", "ok",
]);

/** Digit-context words that also map to numbers (used only for Aadhaar). */
const AADHAAR_DIGIT_MAP: Record<string, string> = DIGIT_MAP;

interface Atom {
  letter?: string;
  digit?: string;
}

function atoms(text: string): Atom[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const out: Atom[] = [];
  for (const tok of tokens) {
    if (tok in LETTER_MAP) {
      out.push({ letter: LETTER_MAP[tok] });
      continue;
    }
    if (tok in DIGIT_MAP) {
      out.push({ digit: DIGIT_MAP[tok] });
      continue;
    }
    if (/^[a-z0-9]+$/.test(tok) && tok.length > 1 && !STOPWORDS.has(tok)) {
      // A glued run like "abcd" or "abcd1234f" — expand char by char.
      for (const ch of tok) {
        if (/[0-9]/.test(ch)) out.push({ digit: ch });
        else out.push({ letter: ch.toUpperCase() });
      }
      continue;
    }
    if (/^[a-z]$/.test(tok)) out.push({ letter: tok.toUpperCase() });
    else if (/^[0-9]$/.test(tok)) out.push({ digit: tok });
    // else: filler, skip
  }
  return out;
}

/** Fit a sequence of atoms to the PAN mask: LLLLL DDDD L. */
function fitPan(seq: Atom[]): string | null {
  if (seq.length < 10) return null;
  // Try each 10-length window (handles leading/trailing noise).
  for (let start = 0; start + 10 <= seq.length; start++) {
    const win = seq.slice(start, start + 10);
    let s = "";
    for (let i = 0; i < 10; i++) {
      const wantLetter = i < 5 || i === 9;
      const a = win[i];
      if (wantLetter) s += a.letter ?? digitToLetter(a.digit);
      else s += a.digit ?? letterToDigit(a.letter);
    }
    if (PAN_REGEX.test(s)) return s;
  }
  return null;
}

const D2L: Record<string, string> = {
  "0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G",
};
const L2D: Record<string, string> = {
  O: "0", I: "1", L: "1", Z: "2", S: "5", B: "8", G: "6",
};
function digitToLetter(d?: string): string {
  return (d && D2L[d]) || d || "";
}
function letterToDigit(l?: string): string {
  return (l && L2D[l]) || l || "";
}

/** Parse a PAN from clean or spoken/spelled input. */
export function parsePan(text: string): string | null {
  const clean = extractEntities(text).pan;
  if (clean) return clean;
  return fitPan(atoms(text));
}

/** Parse a 12-digit Aadhaar from clean or spoken input. */
export function parseAadhaar(text: string): string | null {
  const clean = extractEntities(text).aadhaar;
  if (clean) return clean;

  const cleaned = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ");
  let digits = "";
  for (const tok of cleaned.split(/\s+/).filter(Boolean)) {
    if (tok in AADHAAR_DIGIT_MAP) digits += AADHAAR_DIGIT_MAP[tok];
    else if (/^[0-9]+$/.test(tok)) digits += tok;
  }
  digits = normalizeAadhaar(digits);
  if (AADHAAR_REGEX.test(digits)) return digits;
  // Window search if extra digits crept in.
  if (digits.length > 12) {
    for (let i = 0; i + 12 <= digits.length; i++) {
      const w = digits.slice(i, i + 12);
      if (AADHAAR_REGEX.test(w)) return w;
    }
  }
  return null;
}

/** Parse a value for a given session field key from spoken/typed text. */
export function parseFieldValue(key: string, text: string): string | null {
  if (key === "pan") return parsePan(text);
  if (key === "aadhaar") return parseAadhaar(text);
  const t = text.trim();
  return t.length > 0 ? t : null;
}
