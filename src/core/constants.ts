import {Platform} from 'react-native';
import type {JointProps} from './type';

export const PIXEL_FORMAT = Platform.OS === 'android' ? 'yuv' : 'rgb';
export const delegate = Platform.OS === 'ios' ? 'core-ml' : 'default';

export const LINE_WIDTH = 3;
export const MIN_CONFIDENCE = 0.3;
export const ThunderFrameSize = 256;
export const LightningFrameSize = 192;

export const Joints: JointProps = {
  nose: 0,
  left: {
    eyebrow: 1,
    ear: 3,
    shoulder: 5,
    elbow: 7,
    wrist: 9,
    hip: 11,
    knee: 13,
    ankle: 15,
  },
  right: {
    eyebrow: 2,
    ear: 4,
    shoulder: 6,
    elbow: 8,
    wrist: 10,
    hip: 12,
    knee: 14,
    ankle: 16,
  },
};

const {left, right} = Joints;

export const JointsConnection = [
  // left shoulder -> elbow
  left.shoulder,
  left.elbow,
  // right shoulder -> elbow
  right.shoulder,
  right.elbow,
  // left elbow -> wrist
  left.elbow,
  left.wrist,
  // right elbow -> wrist
  right.elbow,
  right.wrist,
  // left hip -> knee
  left.hip,
  left.knee,
  // right hip -> knee
  right.hip,
  right.knee,
  // left knee -> ankle
  left.knee,
  left.ankle,
  // right knee -> ankle
  right.knee,
  right.ankle,
  // left hip -> right hip
  left.hip,
  right.hip,
  // left shoulder -> right shoulder
  left.shoulder,
  right.shoulder,
  // left shoulder -> left hip
  left.shoulder,
  left.hip,
  // right shoulder -> right hip
  right.shoulder,
  right.hip,
];
