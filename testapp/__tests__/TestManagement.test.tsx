import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TestManagerDashboardScreen } from '../src/screens/TestManagement/TestManagerDashboardScreen';
import { CreateEditTestScreen } from '../src/screens/TestManagement/CreateEditTestScreen';
import { StandardManagementScreen } from '../src/screens/TestManagement/StandardManagementScreen';
import { AddStandardScreen } from '../src/screens/TestManagement/AddStandardScreen';
import { UserSession } from '../src/types/jalq';

const mockManagerSession: UserSession = {
  technicianName: 'Dr. Alex Chen',
  technicianId: 'MGR-8012',
  facility: 'Calibration Lab',
  role: 'TEST_MANAGER',
};

jest.mock('../src/services/jalqApi', () => ({
  fetchChemicalTests: jest.fn().mockResolvedValue([
    {
      test_id: 'IRON_001',
      name: 'Iron Concentration Test',
      version: 1,
      status: 'PUBLISHED',
      sample_type: 'Water',
      unit: 'mg/L',
      standards_count: 5,
      updated_at: '2026-09-11T12:00:00Z',
    },
  ]),
  fetchTestDetails: jest.fn().mockResolvedValue({
    test_id: 'IRON_001',
    name: 'Iron Concentration Test',
    version: 1,
    status: 'PUBLISHED',
    sample_type: 'Water',
    unit: 'mg/L',
    incubation_seconds: 300,
    incubation_tolerance_seconds: 60,
    description: 'Measures dissolved iron',
    sample_requirements: '10 mL sample',
    video_url: '',
    notes: '',
    standards: [
      {
        id: 'IRON_0',
        standard_id: 'IRON_001_STD_00',
        test_id: 'IRON_001',
        test_version: 1,
        value: 0,
        unit: 'mg/L',
        name: '0 mg/L',
        level: '0',
        color_name: 'Clear / Water Blank',
        description: 'No reaction',
        reference_color: {
          hex: '#EDEAE4',
          rgb: { r: 237, g: 234, b: 228 },
          hsv: { h: 40, s: 3.8, v: 92.9 },
          lab: { l: 92.5, a: -0.2, b: 3.5 },
        },
        quality: { overall: 95.0, valid_pixel_percentage: 92.0 },
        reference_image: '',
        status: 'ACTIVE',
        sample_count: 1,
      },
    ],
    procedure: [],
    reagents: [],
  }),
  publishChemicalTest: jest.fn().mockResolvedValue({ status: 'PUBLISHED' }),
  deleteColorStandard: jest.fn().mockResolvedValue(true),
}));

describe('Test Management Components', () => {
  it('renders TestManagerDashboardScreen correctly', async () => {
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <TestManagerDashboardScreen
          session={mockManagerSession}
          onCreateTest={jest.fn()}
          onEditTest={jest.fn()}
          onManageStandards={jest.fn()}
          onPreviewAsTester={jest.fn()}
          onSwitchToTesterMode={jest.fn()}
          onLogout={jest.fn()}
        />
      );
    });
    expect(tree).toBeDefined();
  });

  it('renders CreateEditTestScreen correctly', async () => {
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <CreateEditTestScreen
          session={mockManagerSession}
          onBack={jest.fn()}
          onSaved={jest.fn()}
        />
      );
    });
    expect(tree).toBeDefined();
  });

  it('renders StandardManagementScreen correctly', async () => {
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <StandardManagementScreen
          session={mockManagerSession}
          testId="IRON_001"
          onBack={jest.fn()}
          onAddStandard={jest.fn()}
        />
      );
    });
    expect(tree).toBeDefined();
  });

  it('renders AddStandardScreen correctly', async () => {
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <AddStandardScreen
          session={mockManagerSession}
          testId="IRON_001"
          onBack={jest.fn()}
          onStandardSaved={jest.fn()}
        />
      );
    });
    expect(tree).toBeDefined();
  });
});
