import { useCallback, useRef, useState } from 'react';
import type { Camera, CameraCaptureError, VideoFile } from 'react-native-vision-camera';
import { canTransition, type RecordingState } from '../types';

interface UseVideoRecordingResult {
  state: RecordingState;
  errorMessage: string | null;
  video: VideoFile | null;
  startRecording: () => void;
  requestStop: () => void;
  reset: () => void;
}

const log = (...args: unknown[]) => console.log('[Recorder]', ...args);

export function useVideoRecording(
  cameraRef: React.RefObject<Camera | null>,
): UseVideoRecordingResult {
  const [state, setStateRaw] = useState<RecordingState>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoFile | null>(null);

  // Guards against duplicate stopRecording() calls from repeated QR frames.
  const isStoppingRef = useRef(false);

  const setState = useCallback((next: RecordingState) => {
    setStateRaw(prev => {
      if (!canTransition(prev, next)) {
        console.warn(`[Recorder] Ignored invalid transition ${prev} -> ${next}`);
        return prev;
      }
      log(`${prev} -> ${next}`);
      return next;
    });
  }, []);

  const startRecording = useCallback(() => {
    const camera = cameraRef.current;
    if (camera == null) {
      setErrorMessage('Camera not ready');
      setState('ERROR');
      return;
    }

    setErrorMessage(null);
    setVideo(null);
    isStoppingRef.current = false;
    setState('STARTING');

    try {
      camera.startRecording({
        onRecordingFinished: (finished: VideoFile) => {
          log('Recording finalized. Path:', finished.path);
          setVideo(finished);
          setState('COMPLETED');
        },
        onRecordingError: (error: CameraCaptureError) => {
          console.error('[Recorder] Recording error:', error);
          setErrorMessage(error.message);
          setState('ERROR');
        },
      });
      log('Recording started');
      setState('RECORDING');
    } catch (e) {
      console.error('[Recorder] Failed to start recording:', e);
      setErrorMessage(e instanceof Error ? e.message : 'Failed to start recording');
      setState('ERROR');
    }
  }, [cameraRef, setState]);

  const requestStop = useCallback(() => {
    if (isStoppingRef.current) {
      log('Stop already requested, ignoring duplicate call');
      return;
    }
    const camera = cameraRef.current;
    if (camera == null) return;

    isStoppingRef.current = true;
    setState('STOPPING');
    log('Stop requested');

    camera
      .stopRecording()
      .catch(e => {
        console.error('[Recorder] Failed to stop recording:', e);
        setErrorMessage(e instanceof Error ? e.message : 'Failed to stop recording');
        setState('ERROR');
      });
  }, [cameraRef, setState]);

  const reset = useCallback(() => {
    isStoppingRef.current = false;
    setErrorMessage(null);
    setVideo(null);
    setState('IDLE');
  }, [setState]);

  return { state, errorMessage, video, startRecording, requestStop, reset };
}
