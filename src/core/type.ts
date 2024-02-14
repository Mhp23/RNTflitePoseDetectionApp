import {SkPath} from '@shopify/react-native-skia/lib/typescript/src/skia/types';

export type JointType =
  | 'eyebrow'
  | 'ear'
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'hip'
  | 'knee'
  | 'ankle';

export type JointProps = {
  nose: number;
  left: {
    [key in JointType]: number;
  };
  right: {
    [key in JointType]: number;
  };
};

export type CurrentPath = {
  path: SkPath;
  color?: string;
  strokeWidth?: number;
};
