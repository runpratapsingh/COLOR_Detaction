import { isValidQRCode, TARGET_QR } from './qrValidator';

test('accepts the exact target string', () => {
  expect(isValidQRCode(TARGET_QR)).toBe(true);
});

test('accepts a JSON payload with matching type', () => {
  expect(isValidQRCode(JSON.stringify({ type: 'STOP_RECORDING', recordingId: 'ABC123' }))).toBe(
    true,
  );
});

test('rejects random QR content', () => {
  expect(isValidQRCode('https://example.com')).toBe(false);
  expect(isValidQRCode('some random text')).toBe(false);
});

test('rejects malformed JSON without throwing', () => {
  expect(isValidQRCode('{not valid json')).toBe(false);
});

test('rejects undefined/empty values', () => {
  expect(isValidQRCode(undefined)).toBe(false);
  expect(isValidQRCode('')).toBe(false);
});
