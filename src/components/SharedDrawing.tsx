import React from 'react';
import {
  Camera,
  useCameraDevice,
  useFrameProcessor,
  useCameraPermission,
} from 'react-native-vision-camera';
import {
  View,
  Text,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {Worklets} from 'react-native-worklets-core';
import {getBestFormat, modelToString} from '../utils';
import {useSharedValue} from 'react-native-reanimated';
import {useResizePlugin} from 'vision-camera-resize-plugin';
import {useTensorflowModel} from 'react-native-fast-tflite';
import {Path, Skia, Canvas, SkiaDomView} from '@shopify/react-native-skia';
import {
  delegate,
  LINE_WIDTH,
  PIXEL_FORMAT,
  MIN_CONFIDENCE,
  JointsConnection,
} from '../core/constants';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

const SharedDrawing: React.FC = () => {
  const canvasRef = React.useRef<SkiaDomView>(null);

  const {hasPermission, requestPermission} = useCameraPermission();

  const model = useTensorflowModel(
    require('../assets/singlepose-thunder-tflite-int8.tflite'),
    delegate,
  );

  const {resize} = useResizePlugin();

  const [position, setPosition] = React.useState<'back' | 'front'>('front');

  const device = useCameraDevice(position);

  const path = useSharedValue(Skia.Path.Make());

  const actualModel = model.state === 'loaded' ? model.model : undefined;

  const format = React.useMemo(() => {
    return device ? getBestFormat(device, 720, 1000) : undefined;
  }, [device]);

  const scaleX = (format?.videoWidth || screenWidth) / screenWidth;

  const flipCamera = React.useCallback(
    () => setPosition(p => (p === 'back' ? 'front' : 'back')),
    [],
  );

  const imageToViewCoordinate = React.useCallback(
    (
      x: number,
      y: number,
      frameWidth = screenWidth,
      frameHeight = screenHeight,
    ) => {
      const offsetX = Math.abs(frameWidth - screenWidth) / 2;
      const offsetY = Math.abs(frameHeight - screenHeight) / 2;
      return {
        x: x * (frameWidth / screenWidth) - offsetX,
        y: y * (frameHeight / screenHeight) - offsetY,
      };
    },
    [],
  );

  const updatePaths = React.useMemo(() => {
    return Worklets.createRunInJsFn(
      (
        coordinates: {
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          frameWidth: number;
          frameHeight: number;
        },
        isClear = false,
      ) => {
        if (isClear) {
          path.value = path.value.reset();
        } else {
          const xy1 = imageToViewCoordinate(
            coordinates.x1,
            coordinates.y1,
            coordinates.frameWidth,
            coordinates.frameHeight,
          );
          const xy2 = imageToViewCoordinate(
            coordinates.x2,
            coordinates.y2,
            coordinates.frameWidth,
            coordinates.frameHeight,
          );
          path.value.moveTo(xy1.x, xy1.y);
          path.value.lineTo(xy2.x, xy2.y);
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputTensor = model.model?.inputs[0];

  const inputWidth = inputTensor?.shape[1] ?? 0;
  const inputHeight = inputTensor?.shape[2] ?? 0;

  const dataType = inputTensor?.dataType ?? 'uint8';

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (actualModel == null || !inputHeight || !inputWidth) {
        return;
      }
      const resized = resize(frame, {
        //@ts-expect-error type mismatch
        dataType,
        size: {
          width: inputWidth,
          height: inputHeight,
        },
        pixelFormat: 'rgb',
      });
      const result = actualModel.runSync([resized]);

      const output = result[0] as unknown as number[];

      updatePaths({} as any, true);

      for (let i = 0; i < JointsConnection.length; i += 2) {
        const from = JointsConnection[i] * 3;
        const to = JointsConnection[i + 1] * 3;

        const confidence = output[from + 2];

        if (confidence < MIN_CONFIDENCE) {
          continue;
        }
        const frameWidth = frame.width;
        const frameHeight = frame.height;

        const y1 = output[from] * screenHeight;
        const x1 = output[from + 1] * screenWidth;
        const y2 = output[to] * screenHeight;
        const x2 = output[to + 1] * screenWidth;

        updatePaths({
          x1,
          y1,
          x2,
          y2,
          frameWidth,
          frameHeight,
        });
      }
    },
    [actualModel],
  );

  React.useEffect(() => {
    if (actualModel == null) {
      return;
    }
    console.log(`Model loaded! Shape:\n${modelToString(actualModel)}]`);
  }, [actualModel]);

  React.useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  return (
    <View onTouchEnd={flipCamera} style={styles.container}>
      {hasPermission && device != null ? (
        <React.Fragment>
          <Canvas ref={canvasRef} style={styles.canvas}>
            <Path
              path={path}
              style="stroke"
              color="#000000"
              strokeWidth={LINE_WIDTH * scaleX * 0.75}
            />
          </Canvas>
          <Camera
            isActive
            fps={15}
            device={device}
            format={format}
            pixelFormat={PIXEL_FORMAT}
            style={StyleSheet.absoluteFill}
            frameProcessor={frameProcessor}
          />
        </React.Fragment>
      ) : (
        <Text>No Camera available.</Text>
      )}
      {model.state === 'loading' && (
        <ActivityIndicator size="small" color="white" />
      )}
      {model.state === 'error' && (
        <Text>Failed to load model! {model.error.message}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {...StyleSheet.absoluteFillObject, zIndex: 1},
});

export default SharedDrawing;
