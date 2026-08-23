/**
 * Phone number normalization/validation for interactive pairing.
 * Accepts formats like "+509 3252-8446", "(234) 801-234-5678", "50932528446".
 */
export function normalizePhone(input, fallback = '') {
  const raw = input == null ? '' : String(input).trim();
  const candidate = raw.length > 0 ? raw : String(fallback ?? '').trim();
  const digits = candidate.replace(/[^\d+]/g, '').replace(/\+/g, '');

  if (!digits.length) {
    return { ok: false, error: 'No number entered.' };
  }
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    return {
      ok: false,
      error: `"${candidate}" is not a valid number. Use country code + number, digits only (8-15 digits).`,
    };
  }
  return { ok: true, phone: digits };
}

/** "50932528446" -> "*******8446" for safe display. */
export function maskPhone(phone = '') {
  const digits = String(phone);
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}
