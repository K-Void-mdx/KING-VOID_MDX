/**
 * Phone number normalization/validation for interactive pairing.
 * Accepts formats like "+234 704 685 5205", "(234) 801-234-5678", "2347046855205".
 * There is deliberately NO fallback/default: the pairing number is whatever
 * the operator types at the prompt, never a configured hidden value.
 */
export function normalizePhone(input) {
  const raw = input == null ? '' : String(input).trim();
  const digits = raw.replace(/[^\d+]/g, '').replace(/\+/g, '');

  if (!digits.length) {
    return { ok: false, error: 'No number entered.' };
  }
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    return {
      ok: false,
      error: `"${raw}" is not a valid number. Use country code + number, digits only (8-15 digits).`,
    };
  }
  return { ok: true, phone: digits };
}

/** "2347046855205" -> "*******8446" for safe display. */
export function maskPhone(phone = '') {
  const digits = String(phone);
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}
