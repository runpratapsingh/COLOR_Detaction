import {
  ChemicalTestDetail,
  ChemicalTestSummary,
  ColorStandard,
  JalqAnalysisResponse,
  ReferenceAnalysisResult,
  UserRole,
} from '../types/jalq';

// Default Wi-Fi LAN / simulator endpoint for FastAPI CV Service
export let JALQ_API_BASE = 'http://192.168.29.205:8000/api/v1';
export let CURRENT_USER_ROLE: UserRole = 'TEST_MANAGER';

export function setApiBaseUrl(url: string) {
  JALQ_API_BASE = url.replace(/\/+$/, '');
}

export function setCurrentUserRole(role: UserRole) {
  CURRENT_USER_ROLE = role;
}

// Fallback seed data in case phone is offline or disconnected during demo presentation
const FALLBACK_IRON_TEST: ChemicalTestDetail = {
  test_id: 'IRON_001',
  version: 1,
  name: 'Iron Concentration Test',
  status: 'DRAFT',
  sample_type: 'Water',
  unit: 'mg/L',
  incubation_seconds: 300,
  incubation_tolerance_seconds: 60,
  description:
    'Determines dissolved iron (Fe²⁺/Fe³⁺) concentration in water samples via bipyridine/phenanthroline colorimetry.',
  sample_requirements: '10 mL fresh water sample in clean container, 15°C–30°C.',
  procedure: [
    {
      step_number: 1,
      title: 'Add Water Sample',
      instruction: 'Fill reaction bottle with 10 mL of water sample up to the marked fill line.',
      tip: 'Ensure sample is clear and free of suspended grit or rust flakes.',
    },
    {
      step_number: 2,
      title: 'Add Reagent Powder Pillow',
      instruction: 'Tear open Reagent Pillow A (Iron Indicator) and add entire contents into the bottle.',
      tip: 'Tap the packet gently to ensure complete transfer.',
    },
    {
      step_number: 3,
      title: 'Cap & Invert to Dissolve',
      instruction: 'Cap tightly and invert gently 10 times until the powder completely dissolves.',
      tip: 'Do not shake violently to avoid excessive micro-bubbles.',
    },
    {
      step_number: 4,
      title: 'Incubate Reaction',
      instruction: 'Place bottle on flat surface away from direct sun for reaction to develop (5 minutes).',
      tip: 'Color shifts from clear to orange or reddish-pink in proportion to dissolved iron.',
    },
    {
      step_number: 5,
      title: 'Capture Reaction in JalQ',
      instruction: 'Position bottle against a neutral white background and frame within camera guide.',
      tip: 'Avoid camera flash or overhead reflections on the bottle surface.',
    },
  ],
  reagents: [
    { name: 'Reagent Pillow A (Iron Indicator Powder)', amount: '1 Pillow / 10 mL' },
    { name: 'Reaction Bottle (15 mL Clear)', amount: '1 Bottle' },
  ],
  video_url: 'https://assets.mixkit.co/videos/preview/mixkit-chemical-reaction-in-a-lab-tube-40292-large.mp4',
  notes: 'Ensure standard reaction time of 5 minutes before camera capture.',
  standards: [
    {
      id: 'IRON_0',
      standard_id: 'IRON_001_STD_00',
      test_id: 'IRON_001',
      test_version: 1,
      value: 0.0,
      unit: 'mg/L',
      name: 'Iron 0.0 mg/L',
      level: '0.0 mg/L',
      color_name: 'Clear / Faint Yellow (0 mg/L)',
      description: 'Baseline blank control with no iron present. Solution remains clear.',
      reference_color: {
        hex: '#FFF9E8',
        rgb: { r: 255, g: 249, b: 232 },
        hsv: { h: 44.3, s: 9.0, v: 100.0 },
        lab: { l: 98.1, a: -1.2, b: 8.9 },
      },
      quality: { overall: 94.5, valid_pixel_percentage: 92.0 },
      tolerance_delta_e: 3.0,
      sample_count: 1,
      status: 'ACTIVE',
    },
    {
      id: 'IRON_1',
      standard_id: 'IRON_001_STD_01',
      test_id: 'IRON_001',
      test_version: 1,
      value: 1.0,
      unit: 'mg/L',
      name: 'Iron 1.0 mg/L',
      level: '1.0 mg/L',
      color_name: 'Orange (1.0 mg/L)',
      description: 'Light orange reaction indicating approximately 1.0 mg/L iron concentration.',
      reference_color: {
        hex: '#F5A45B',
        rgb: { r: 245, g: 164, b: 91 },
        hsv: { h: 28.4, s: 62.9, v: 96.1 },
        lab: { l: 72.4, a: 25.1, b: 52.8 },
      },
      quality: { overall: 91.2, valid_pixel_percentage: 89.4 },
      tolerance_delta_e: 3.0,
      sample_count: 1,
      status: 'ACTIVE',
    },
    {
      id: 'IRON_2',
      standard_id: 'IRON_001_STD_02',
      test_id: 'IRON_001',
      test_version: 1,
      value: 2.0,
      unit: 'mg/L',
      name: 'Iron 2.0 mg/L',
      level: '2.0 mg/L',
      color_name: 'Reddish Orange (2.0 mg/L)',
      description: 'Moderate reddish-orange reaction indicating approximately 2.0 mg/L dissolved iron.',
      reference_color: {
        hex: '#D9573F',
        rgb: { r: 217, g: 87, b: 63 },
        hsv: { h: 9.4, s: 71.0, v: 85.1 },
        lab: { l: 52.8, a: 49.3, b: 41.7 },
      },
      quality: { overall: 89.8, valid_pixel_percentage: 86.5 },
      tolerance_delta_e: 3.0,
      sample_count: 1,
      status: 'ACTIVE',
    },
    {
      id: 'IRON_3',
      standard_id: 'IRON_001_STD_03',
      test_id: 'IRON_001',
      test_version: 1,
      value: 3.0,
      unit: 'mg/L',
      name: 'Iron 3.0 mg/L',
      level: '3.0 mg/L',
      color_name: 'Red-Orange (3.0 mg/L)',
      description: 'Intense red-orange reaction corresponding to 3.0 mg/L iron concentration.',
      reference_color: {
        hex: '#C94345',
        rgb: { r: 201, g: 67, b: 69 },
        hsv: { h: 359.1, s: 66.7, v: 78.8 },
        lab: { l: 45.3, a: 52.7, b: 31.4 },
      },
      quality: { overall: 88.5, valid_pixel_percentage: 85.0 },
      tolerance_delta_e: 3.0,
      sample_count: 1,
      status: 'ACTIVE',
    },
    {
      id: 'IRON_4',
      standard_id: 'IRON_001_STD_04',
      test_id: 'IRON_001',
      test_version: 1,
      value: 4.0,
      unit: 'mg/L',
      name: 'Iron 4.0 mg/L',
      level: '4.0+ mg/L',
      color_name: 'Deep Red (4.0+ mg/L)',
      description: 'Deep crimson red reaction denoting high dissolved iron at or above 4.0 mg/L.',
      reference_color: {
        hex: '#B83B3B',
        rgb: { r: 184, g: 59, b: 59 },
        hsv: { h: 0.0, s: 67.9, v: 72.2 },
        lab: { l: 39.8, a: 51.1, b: 28.6 },
      },
      quality: { overall: 87.0, valid_pixel_percentage: 83.2 },
      tolerance_delta_e: 3.0,
      sample_count: 1,
      status: 'ACTIVE',
    },
  ],
  active: true,
};

export async function fetchChemicalTests(status?: string, role?: UserRole): Promise<ChemicalTestSummary[]> {
  const effRole = role || CURRENT_USER_ROLE;
  try {
    let url = `${JALQ_API_BASE}/tests`;
    if (status) url += `?status=${encodeURIComponent(status)}`;
    const res = await fetch(url, {
      credentials: 'omit',
      headers: {
        'X-User-Role': effRole,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.warn('[JalqApi] Failed to fetch tests from backend, using seeded fallback:', e);
  }

  // Fallback offline summary
  return [
    {
      id: FALLBACK_IRON_TEST.test_id,
      test_id: FALLBACK_IRON_TEST.test_id,
      version: 1,
      name: FALLBACK_IRON_TEST.name,
      status: FALLBACK_IRON_TEST.status,
      sample_type: FALLBACK_IRON_TEST.sample_type,
      unit: FALLBACK_IRON_TEST.unit,
      incubation_seconds: FALLBACK_IRON_TEST.incubation_seconds,
      description: FALLBACK_IRON_TEST.description,
      standards_count: FALLBACK_IRON_TEST.standards.length,
      active: true,
    },
  ];
}

export async function fetchTestDetails(testId: string, version?: number): Promise<ChemicalTestDetail> {
  try {
    let url = `${JALQ_API_BASE}/tests/${testId}`;
    if (version) url += `?version=${version}`;
    const res = await fetch(url, { credentials: 'omit' });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn(`[JalqApi] Failed to fetch test ${testId} from backend, using fallback:`, e);
  }

  return FALLBACK_IRON_TEST;
}

export async function createChemicalTest(testData: Partial<ChemicalTestDetail>, role?: UserRole): Promise<ChemicalTestDetail> {
  const effRole = role || CURRENT_USER_ROLE;
  const res = await fetch(`${JALQ_API_BASE}/tests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': effRole,
    },
    body: JSON.stringify(testData),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || `Failed to create chemical test (${res.status})`);
  }
  return data as ChemicalTestDetail;
}

export async function updateChemicalTest(testId: string, testData: Partial<ChemicalTestDetail>, role?: UserRole): Promise<ChemicalTestDetail> {
  const effRole = role || CURRENT_USER_ROLE;
  const res = await fetch(`${JALQ_API_BASE}/tests/${testId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': effRole,
    },
    body: JSON.stringify(testData),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || `Failed to update chemical test (${res.status})`);
  }
  return data as ChemicalTestDetail;
}

export async function publishChemicalTest(testId: string, role?: UserRole): Promise<ChemicalTestDetail> {
  const effRole = role || CURRENT_USER_ROLE;
  const res = await fetch(`${JALQ_API_BASE}/tests/${testId}/publish`, {
    method: 'POST',
    headers: {
      'X-User-Role': effRole,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || `Failed to publish test (${res.status})`);
  }
  return data as ChemicalTestDetail;
}

export async function createNewTestVersion(testId: string, role?: UserRole): Promise<ChemicalTestDetail> {
  const effRole = role || CURRENT_USER_ROLE;
  const res = await fetch(`${JALQ_API_BASE}/tests/${testId}/new-version`, {
    method: 'POST',
    headers: {
      'X-User-Role': effRole,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || `Failed to create new test version (${res.status})`);
  }
  return data as ChemicalTestDetail;
}

export async function fetchTestStandards(testId: string, version?: number): Promise<ColorStandard[]> {
  try {
    let url = `${JALQ_API_BASE}/tests/${testId}/standards`;
    if (version) url += `?version=${version}`;
    const res = await fetch(url, { credentials: 'omit' });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn(`[JalqApi] Failed to fetch standards for test ${testId}:`, e);
  }
  return FALLBACK_IRON_TEST.standards;
}

export interface AnalyzeReferenceOptions {
  bottleGuide?: [number, number, number, number];
  liquidRoi?: [number, number, number, number];
  whiteBalanceMethod?: string;
}

export async function analyzeReferenceSample(
  testId: string,
  imageUri: string,
  imageBase64?: string,
  options?: AnalyzeReferenceOptions
): Promise<ReferenceAnalysisResult> {
  // If base64 is provided directly or imageUri is a data URI, try the dedicated JSON endpoint first
  const isDataUri = imageUri.startsWith('data:');
  const candidateBase64 = imageBase64 || (isDataUri ? imageUri.split(',')[1] : null);
  const wbMethod = options?.whiteBalanceMethod || 'REFERENCE_PATCH';

  if (candidateBase64) {
    try {
      const jsonEndpoint = `${JALQ_API_BASE}/tests/${testId}/standards/analyze-reference-json`;
      const jsonRes = await fetch(jsonEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          image_base64: candidateBase64,
          white_balance_method: wbMethod,
          bottle_guide: options?.bottleGuide,
          liquid_roi: options?.liquidRoi,
        }),
      });
      const jsonPayload = await jsonRes.json().catch(() => null);
      if (jsonRes.ok && jsonPayload) {
        return jsonPayload as ReferenceAnalysisResult;
      }
      if (jsonPayload?.detail) {
        throw new Error(jsonPayload.detail);
      }
    } catch (jsonErr: any) {
      // If error is a validation failure from backend, rethrow it
      if (jsonErr.message && !jsonErr.message.includes('fetch') && !jsonErr.message.includes('Network request failed')) {
        throw jsonErr;
      }
    }
  }

  // Multipart FormData upload
  const formData = new FormData();
  const isPng = imageUri.toLowerCase().includes('.png');
  const normalizedUri =
    imageUri.startsWith('file://') || imageUri.startsWith('content://') || imageUri.startsWith('data:')
      ? imageUri
      : `file://${imageUri}`;

  formData.append('image', {
    uri: normalizedUri,
    name: isPng ? 'reference_sample.png' : 'reference_sample.jpg',
    type: isPng ? 'image/png' : 'image/jpeg',
  } as any);

  if (candidateBase64) {
    formData.append('image_base64', candidateBase64);
  }
  formData.append('white_balance_method', wbMethod);

  if (options?.bottleGuide) {
    formData.append('guide_x_min', String(options.bottleGuide[0]));
    formData.append('guide_y_min', String(options.bottleGuide[1]));
    formData.append('guide_x_max', String(options.bottleGuide[2]));
    formData.append('guide_y_max', String(options.bottleGuide[3]));
  }

  if (options?.liquidRoi) {
    formData.append('liquid_x_min', String(options.liquidRoi[0]));
    formData.append('liquid_y_min', String(options.liquidRoi[1]));
    formData.append('liquid_x_max', String(options.liquidRoi[2]));
    formData.append('liquid_y_max', String(options.liquidRoi[3]));
  }

  const endpoint = `${JALQ_API_BASE}/tests/${testId}/standards/analyze-reference`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const msg = payload?.detail || `Reference analysis failed (${response.status})`;
    throw new Error(msg);
  }
  return payload as ReferenceAnalysisResult;
}

function formatApiDetail(detail: any, fallback: string): string {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: any) => {
        if (typeof item === 'string') return item;
        const field = item.loc ? item.loc[item.loc.length - 1] : '';
        return field ? `${field}: ${item.msg}` : item.msg || JSON.stringify(item);
      })
      .join('\n');
  }
  if (typeof detail === 'object') {
    return detail.message || JSON.stringify(detail);
  }
  return String(detail);
}

export async function createColorStandard(testId: string, standardData: any, role?: UserRole): Promise<ColorStandard> {
  const effRole = role || CURRENT_USER_ROLE;
  const res = await fetch(`${JALQ_API_BASE}/tests/${testId}/standards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': effRole,
    },
    body: JSON.stringify(standardData),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(formatApiDetail(data?.detail, `Failed to save color standard (${res.status})`));
  }
  return data as ColorStandard;
}

export async function updateColorStandard(testId: string, standardId: string, standardData: any, role?: UserRole): Promise<ColorStandard> {
  const effRole = role || CURRENT_USER_ROLE;
  const res = await fetch(`${JALQ_API_BASE}/tests/${testId}/standards/${standardId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': effRole,
    },
    body: JSON.stringify(standardData),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(formatApiDetail(data?.detail, `Failed to update standard (${res.status})`));
  }
  return data as ColorStandard;
}

export async function deleteColorStandard(testId: string, standardId: string, role?: UserRole): Promise<boolean> {
  const effRole = role || CURRENT_USER_ROLE;
  const res = await fetch(`${JALQ_API_BASE}/tests/${testId}/standards/${standardId}`, {
    method: 'DELETE',
    headers: {
      'X-User-Role': effRole,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || `Failed to delete standard (${res.status})`);
  }
  return true;
}

export async function addReferenceSampleToStandard(testId: string, standardId: string, imageUri: string, role?: UserRole): Promise<ColorStandard> {
  const effRole = role || CURRENT_USER_ROLE;
  const formData = new FormData();
  const isPng = imageUri.toLowerCase().endsWith('.png');

  formData.append('image', {
    uri: imageUri,
    name: isPng ? 'reference_sample.png' : 'reference_sample.jpg',
    type: isPng ? 'image/png' : 'image/jpeg',
  } as any);

  const endpoint = `${JALQ_API_BASE}/tests/${testId}/standards/${standardId}/samples`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-User-Role': effRole,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail || `Failed to add sample (${response.status})`);
  }
  return payload as ColorStandard;
}

export interface AnalyzeOptions {
  imageUri: string;
  testId: string;
  incubationSeconds?: number;
  whiteBalanceMethod?: string;
  bottleGuide?: [number, number, number, number];
  liquidRoi?: [number, number, number, number];
  debug?: boolean;
}

export async function analyzeBottleCapture(options: AnalyzeOptions): Promise<JalqAnalysisResponse> {
  const formData = new FormData();
  const uri = options.imageUri;
  const isPng = uri.toLowerCase().endsWith('.png');

  formData.append('image', {
    uri: uri,
    name: isPng ? 'bottle_sample.png' : 'bottle_sample.jpg',
    type: isPng ? 'image/png' : 'image/jpeg',
  } as any);

  if (options.incubationSeconds !== undefined) {
    formData.append('incubation_seconds', String(options.incubationSeconds));
  }
  if (options.whiteBalanceMethod) {
    formData.append('white_balance_method', options.whiteBalanceMethod);
  }
  if (options.bottleGuide) {
    formData.append('guide_x_min', String(options.bottleGuide[0]));
    formData.append('guide_y_min', String(options.bottleGuide[1]));
    formData.append('guide_x_max', String(options.bottleGuide[2]));
    formData.append('guide_y_max', String(options.bottleGuide[3]));
  }
  if (options.liquidRoi) {
    formData.append('liquid_x_min', String(options.liquidRoi[0]));
    formData.append('liquid_y_min', String(options.liquidRoi[1]));
    formData.append('liquid_x_max', String(options.liquidRoi[2]));
    formData.append('liquid_y_max', String(options.liquidRoi[3]));
  }
  formData.append('debug', String(options.debug ?? true));

  const endpoint = `${JALQ_API_BASE}/tests/${options.testId}/analyze`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const msg =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as any).detail)
        : `Analysis failed (${response.status})`;
    throw new Error(msg);
  }

  return payload as JalqAnalysisResponse;
}
