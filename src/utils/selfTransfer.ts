/**
 * Detects self-transfer descriptions ("Transfer to ... (self)", "Self transfer", ...).
 * Shared by the PhonePe importer and the bank-statement (PDF) importer so both
 * classify transfers the same way.
 */
export function isSelfTransferDescription(desc: string): boolean {
  const d = desc.toLowerCase();
  return (
    /transfer\s+(to|from).*\(self\)/.test(d) ||
    /self\s*transfer/.test(d) ||
    /transfer\s+to\s+.*self/.test(d) ||
    /transfer\s+from\s+.*self/.test(d) ||
    /\bto own account\b/.test(d) ||
    /\bown account\b/.test(d)
  );
}

/**
 * True when the narration references one of the user's other account numbers
 * (e.g. "NEFT to AC 5010045217832") – i.e. an internal transfer leg.
 */
export function referencesOwnAccountNumber(desc: string, ownLast4s: string[]): boolean {
  if (!desc || ownLast4s.length === 0) return false;
  const digits = desc.replace(/\D/g, '');
  return ownLast4s.some(l4 => l4.length === 4 && (digits.includes(l4) || desc.includes(l4)));
}
