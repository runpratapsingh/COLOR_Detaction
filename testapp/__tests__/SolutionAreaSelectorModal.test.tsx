import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SolutionAreaSelectorModal } from '../src/components/SolutionAreaSelectorModal';
import { Image, Text } from 'react-native';

describe('SolutionAreaSelectorModal', () => {
  beforeEach(() => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => {
      success(1080, 1920);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('renders correctly when visible with guidance text', () => {
    let tree: ReactTestRenderer.ReactTestRenderer | null = null;
    act(() => {
      tree = ReactTestRenderer.create(
        <SolutionAreaSelectorModal
          visible={true}
          imageUri="file:///test_image.jpg"
          onCancel={jest.fn()}
          onConfirm={jest.fn()}
        />
      );
    });

    const root = tree!.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children);
    const flattenedTexts = texts.flat(Infinity).join(' ');

    expect(flattenedTexts).toContain('Verify Solution Area');
    expect(flattenedTexts).toContain('Adjust box to fit liquid only');
    expect(flattenedTexts).toContain('Confirm Liquid Area & Analyze');
  });

  it('calls onConfirm with adjusted or default ROI when confirmed', () => {
    const handleConfirm = jest.fn();
    let tree: ReactTestRenderer.ReactTestRenderer | null = null;

    act(() => {
      tree = ReactTestRenderer.create(
        <SolutionAreaSelectorModal
          visible={true}
          imageUri="file:///test_image.jpg"
          initialLiquidRoi={[0.3, 0.4, 0.7, 0.7]}
          onCancel={jest.fn()}
          onConfirm={handleConfirm}
        />
      );
    });

    const root = tree!.root;
    // Find confirm button
    const confirmButton = root.findAll((node) => {
      return (
        node.props.onPress &&
        node.findAllByType(Text).some((t) => String(t.props.children).includes('Confirm Liquid Area'))
      );
    })[0];

    expect(confirmButton).toBeDefined();

    act(() => {
      confirmButton.props.onPress();
    });

    expect(handleConfirm).toHaveBeenCalledWith([0.3, 0.4, 0.7, 0.7]);
  });
});
