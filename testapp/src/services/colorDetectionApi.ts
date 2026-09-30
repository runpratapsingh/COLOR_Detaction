import { AnalysisResponse, AnalyzeParams } from '../types/colorDetection';

// Local Wi-Fi IP address for mobile devices on same network
export const DEFAULT_API_URL = 'http://192.168.1.46:8000/api/v1';

export async function analyzeBottleImage(
  params: AnalyzeParams,
  baseUrl: string = DEFAULT_API_URL
): Promise<AnalysisResponse> {
  const formData = new FormData();

  const uri = params.imageUri;
  const isPng = uri.toLowerCase().includes('.png') || uri.toLowerCase().includes('png');
  const fileName = isPng ? 'bottle_capture.png' : 'bottle_capture.jpg';
  const fileType = isPng ? 'image/png' : 'image/jpeg';

  const fileData = {
    uri: uri,
    name: fileName,
    type: fileType,
  };

  formData.append('image', fileData as any);

  if (params.testCode) {
    formData.append('test_code', params.testCode);
  }
  if (params.incubationSeconds !== undefined) {
    formData.append('incubation_seconds', String(params.incubationSeconds));
  }
  if (params.whiteBalanceMethod) {
    formData.append('white_balance_method', params.whiteBalanceMethod);
  }
  if (params.targetColors && params.targetColors.length > 0) {
    formData.append('target_colors', JSON.stringify(params.targetColors));
  }
  formData.append('debug', String(params.debug ?? true));

  const response = await fetch(`${baseUrl}/color-tests/analyze`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : 'Analysis request failed.';
    throw new Error(message);
  }

  return payload as AnalysisResponse;
}

/**
 * Multi-shot analysis — submit 2 or 3 rapid photos of the same bottle.
 *
 * The backend processes each image independently, drops any that fail
 * validation, then averages the Lab values of the passing shots before
 * running color matching. This dramatically improves repeatability in
 * real-world field conditions (varying light, hand shake, auto-exposure).
 *
 * Usage: take 3 photos in quick succession, pass all 3 URIs here.
 * Falls back to single-shot result automatically if only 1 shot passes.
 */
export async function analyzeBottleImageMultiShot(
  imageUris: [string] | [string, string] | [string, string, string],
  params: Omit<AnalyzeParams, 'imageUri'>,
  baseUrl: string = DEFAULT_API_URL
): Promise<AnalysisResponse> {
  const formData = new FormData();

  imageUris.forEach((uri, index) => {
    const fieldName = `image_${index + 1}`;
    const isPng = uri.toLowerCase().includes('.png');
    formData.append(fieldName, {
      uri,
      name: isPng ? `shot_${index + 1}.png` : `shot_${index + 1}.jpg`,
      type: isPng ? 'image/png' : 'image/jpeg',
    } as any);
  });

  if (params.testCode) {
    formData.append('test_code', params.testCode);
  }
  if (params.incubationSeconds !== undefined) {
    formData.append('incubation_seconds', String(params.incubationSeconds));
  }
  if (params.whiteBalanceMethod) {
    formData.append('white_balance_method', params.whiteBalanceMethod);
  }
  if (params.targetColors && params.targetColors.length > 0) {
    formData.append('target_colors', JSON.stringify(params.targetColors));
  }

  const response = await fetch(`${baseUrl}/analyze/multi`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : 'Multi-shot analysis request failed.';
    throw new Error(message);
  }

  return payload as AnalysisResponse;
}
