import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChemicalTestDetail, JalqAnalysisResponse } from '../types/jalq';

export type RootStackParamList = {
  Login: undefined;
  TestManagerDashboard: undefined;
  CreateEditTest: { testId?: string } | undefined;
  StandardManagement: { testId: string };
  AddStandard: { testId: string };
  TestList: undefined;
  TestDetails: { testId: string };
  Incubation: { test: ChemicalTestDetail };
  CameraCapture: { test: ChemicalTestDetail; incubationSeconds: number };
  Result: {
    test: ChemicalTestDetail;
    result: JalqAnalysisResponse;
    capturedUri: string;
  };
};

export type RootStackNavigationProp<T extends keyof RootStackParamList> =
  NativeStackNavigationProp<RootStackParamList, T>;

export type RootStackRouteProp<T extends keyof RootStackParamList> =
  RouteProp<RootStackParamList, T>;
