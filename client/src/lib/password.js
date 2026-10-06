const WORDS = ['Mint', 'Lotus', 'River', 'Cedar', 'Maple', 'Pearl', 'Coral', 'Sage', 'Amber', 'Delta', 'Orbit', 'Nova', 'Tulip', 'Breeze', 'Falcon', 'Harbor'];

/** Easy-to-read temporary password, e.g. "Cedar-4821-Pearl" (letters + numbers, 14+ chars). */
export function generatePassword() {
  const r = new Uint32Array(3);
  crypto.getRandomValues(r);
  return `${WORDS[r[0] % WORDS.length]}-${1000 + (r[1] % 9000)}-${WORDS[r[2] % WORDS.length]}`;
}

export const isStrong = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
