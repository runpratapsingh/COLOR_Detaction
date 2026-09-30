import { useRef, useState } from 'react';
import { useCodeScanner, type Code } from 'react-native-vision-camera';
import { isValidQRCode } from '../utils/qrValidator';

interface UseQRCodeDetectionProps {
  /** Only scan while actively recording; ignore codes otherwise. */
  isActive: boolean;
  onValidQRDetected: (value: string) => void;
}

const log = (...args: unknown[]) => console.log('[QR]', ...args);

export function useQRCodeDetection({ isActive, onValidQRDetected }: UseQRCodeDetectionProps) {
  const [lastQrValue, setLastQrValue] = useState<string | null>(null);
  // Prevents re-firing onValidQRDetected while the same code stays in frame
  // for multiple scan callbacks (the scanner fires repeatedly, not once).
  const hasFiredRef = useRef(false);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes: Code[]) => {
      if (!isActive || hasFiredRef.current) return;

      for (const code of codes) {
        if (!code.value) continue;
        log('Code detected:', code.value);

        if (isValidQRCode(code.value)) {
          log('QR validated:', code.value);
          hasFiredRef.current = true;
          setLastQrValue(code.value);
          onValidQRDetected(code.value);
          return;
        }
      }
    },
  });

  const resetDetection = () => {
    hasFiredRef.current = false;
    setLastQrValue(null);
  };

  return { codeScanner, lastQrValue, resetDetection };
}
