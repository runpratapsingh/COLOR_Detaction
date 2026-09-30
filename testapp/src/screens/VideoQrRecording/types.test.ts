import { canTransition } from './types';

test('allows the happy-path sequence', () => {
  expect(canTransition('IDLE', 'STARTING')).toBe(true);
  expect(canTransition('STARTING', 'RECORDING')).toBe(true);
  expect(canTransition('RECORDING', 'QR_DETECTED')).toBe(true);
  expect(canTransition('QR_DETECTED', 'STOPPING')).toBe(true);
  expect(canTransition('STOPPING', 'COMPLETED')).toBe(true);
  expect(canTransition('COMPLETED', 'IDLE')).toBe(true);
});

test('allows a manual stop from RECORDING directly to STOPPING', () => {
  expect(canTransition('RECORDING', 'STOPPING')).toBe(true);
});

test('rejects invalid transitions called out in the spec', () => {
  expect(canTransition('IDLE', 'STOPPING')).toBe(false);
  expect(canTransition('RECORDING', 'STARTING')).toBe(false);
  expect(canTransition('STOPPING', 'STARTING')).toBe(false);
  expect(canTransition('COMPLETED', 'STOPPING')).toBe(false);
});

test('any state can move to ERROR except terminal loops back only via IDLE', () => {
  expect(canTransition('RECORDING', 'ERROR')).toBe(true);
  expect(canTransition('ERROR', 'IDLE')).toBe(true);
  expect(canTransition('ERROR', 'RECORDING')).toBe(false);
});
