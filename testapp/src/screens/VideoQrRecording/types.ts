/**
 * Explicit recording state machine.
 *
 * IDLE -> STARTING -> RECORDING -> QR_DETECTED -> STOPPING -> COMPLETED
 *                                                                 |
 *                                                                 v
 *                                                              (Record Again -> IDLE)
 * Any state -> ERROR (on failure)
 */
export type RecordingState =
  | 'IDLE'
  | 'STARTING'
  | 'RECORDING'
  | 'QR_DETECTED'
  | 'STOPPING'
  | 'COMPLETED'
  | 'ERROR';

const ALLOWED_TRANSITIONS: Record<RecordingState, RecordingState[]> = {
  IDLE: ['STARTING', 'ERROR'],
  STARTING: ['RECORDING', 'ERROR'],
  RECORDING: ['QR_DETECTED', 'STOPPING', 'ERROR'],
  QR_DETECTED: ['STOPPING', 'ERROR'],
  STOPPING: ['COMPLETED', 'ERROR'],
  COMPLETED: ['IDLE', 'ERROR'],
  ERROR: ['IDLE'],
};

export function canTransition(
  from: RecordingState,
  to: RecordingState,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export interface RecordingResult {
  path: string;
  duration: number;
  qrValue: string | null;
}
