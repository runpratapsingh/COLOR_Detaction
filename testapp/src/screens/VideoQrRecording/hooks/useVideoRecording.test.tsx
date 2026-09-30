import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useVideoRecording } from './useVideoRecording';

function makeFakeCamera() {
  return {
    startRecording: jest.fn(),
    stopRecording: jest.fn().mockResolvedValue(undefined),
  };
}

test('requestStop only calls camera.stopRecording once even when called repeatedly', async () => {
  let latestApi: ReturnType<typeof useVideoRecording> | null = null;
  const cameraRef = { current: makeFakeCamera() };

  function LocalHarness() {
    const api = useVideoRecording(cameraRef as any);
    latestApi = api;
    return null;
  }

  await act(async () => {
    ReactTestRenderer.create(<LocalHarness />);
  });

  await act(async () => {
    latestApi!.startRecording();
  });
  expect(cameraRef.current.startRecording).toHaveBeenCalledTimes(1);

  // Simulate the QR scanner firing the same detected code multiple times in a row.
  await act(async () => {
    latestApi!.requestStop();
    latestApi!.requestStop();
    latestApi!.requestStop();
  });

  expect(cameraRef.current.stopRecording).toHaveBeenCalledTimes(1);
});
