/**
 * Configurable QR validation. Swap this out without touching recording logic.
 * Supports a plain target string today; JSON-shaped payloads (e.g.
 * {"type":"STOP_RECORDING","recordingId":"ABC123"}) can be added by extending
 * this function without changing its call sites.
 */
export const TARGET_QR = 'STOP_RECORDING';

export function isValidQRCode(value: string | undefined): boolean {
  if (!value) return false;

  if (value === TARGET_QR) return true;

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && parsed.type === 'STOP_RECORDING') {
      return true;
    }
  } catch {
    // not JSON, fall through
  }

  return false;
}
