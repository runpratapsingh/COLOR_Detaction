import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ResultScreen } from '../src/screens/Result/ResultScreen';
import { ChemicalTestDetail, JalqAnalysisResponse } from '../src/types/jalq';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const mockTest = {
  id: 'IRON_001',
  test_id: 'IRON_001',
  code: 'IRON_001',
  version: 1,
  status: 'PUBLISHED',
  name: 'Iron Concentration Test',
  description: 'Test Iron',
  unit: 'mg/L',
  standards: [
    {
      id: 's1',
      value: 0,
      unit: 'mg/L',
      name: '0 mg/L',
      level: '0',
      color_name: 'Clear',
      reference_color: {
        hex: '#FFFFFF',
        rgb: { r: 255, g: 255, b: 255 },
        lab: { l: 100, a: 0, b: 0 },
      },
    },
  ],
} as unknown as ChemicalTestDetail;

const mockUnmatchedResult = {
  analysis_id: 'a1',
  status: 'RETAKE_IMAGE',
  test_id: 'IRON_001',
  detected_color: {
    hex: '#FF5733',
    rgb: { r: 255, g: 87, b: 51 },
    hsv: { h: 10, s: 80, v: 100 },
    lab: { l: 50, a: 40, b: 30 },
  },
  quality: {
    overall: 80,
    blur: 85,
    exposure: 80,
    reflection: 90,
    roi_uniformity: 85,
    valid_pixel_percentage: 90,
  },
  reasons: ['NO_MATCH_FOUND'],
} as unknown as JalqAnalysisResponse;

const mockMatchedResult = {
  analysis_id: 'a2',
  status: 'SUCCESS',
  test_id: 'IRON_001',
  detected_color: {
    hex: '#FFFFFF',
    rgb: { r: 255, g: 255, b: 255 },
    hsv: { h: 0, s: 0, v: 100 },
    lab: { l: 100, a: 0, b: 0 },
  },
  classification: {
    matched_standard: {
      id: 's1',
      name: '0 mg/L',
      concentration: 0,
      unit: 'mg/L',
      level: '0',
      hex: '#FFFFFF',
      delta_e_00: 1.2,
      match_percentage: 95,
    },
    delta_e_00: 1.2,
    match_quality: 'STRONG',
    confidence: 95,
    standard_distances: [],
  },
  quality: {
    overall: 95,
    blur: 95,
    exposure: 95,
    reflection: 95,
    roi_uniformity: 95,
    valid_pixel_percentage: 95,
  },
} as unknown as JalqAnalysisResponse;

describe('ResultScreen', () => {
  it('does not render Retake button and renders Done button when color is unmatched (isRetake)', () => {
    const onRetake = jest.fn();
    const onNewTest = jest.fn();

    let root: ReactTestRenderer.ReactTestRenderer | null = null;
    ReactTestRenderer.act(() => {
      root = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={initialMetrics}>
          <ResultScreen
            test={mockTest}
            result={mockUnmatchedResult}
            capturedUri="file:///test/path.jpg"
            onRetake={onRetake}
            onNewTest={onNewTest}
          />
        </SafeAreaProvider>,
      );
    });

    const retakeBtns = root!.root.findAllByProps({ testID: 'btn-retake' });
    const completeBtn = root!.root.findByProps({ testID: 'btn-complete' });

    expect(retakeBtns.length).toBe(0);
    expect(completeBtn).toBeDefined();

    // Verify complete/done callback works
    ReactTestRenderer.act(() => {
      completeBtn.props.onPress();
    });
    expect(onNewTest).toHaveBeenCalledTimes(1);
  });

  it('does not render Retake button and renders Complete Test button when analysis is successful', () => {
    const onRetake = jest.fn();
    const onNewTest = jest.fn();

    let root: ReactTestRenderer.ReactTestRenderer | null = null;
    ReactTestRenderer.act(() => {
      root = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={initialMetrics}>
          <ResultScreen
            test={mockTest}
            result={mockMatchedResult}
            capturedUri="file:///test/path.jpg"
            onRetake={onRetake}
            onNewTest={onNewTest}
          />
        </SafeAreaProvider>,
      );
    });

    const retakeBtns = root!.root.findAllByProps({ testID: 'btn-retake' });
    const completeBtn = root!.root.findByProps({ testID: 'btn-complete' });

    expect(retakeBtns.length).toBe(0);
    expect(completeBtn).toBeDefined();
  });
});
