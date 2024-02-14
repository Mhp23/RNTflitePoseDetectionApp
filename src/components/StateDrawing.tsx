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
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import {
  delegate,
  LINE_WIDTH,
  PIXEL_FORMAT,
  MIN_CONFIDENCE,
  JointsConnection,
} from '../core/constants';
import type {CurrentPath} from '../core/type';
import {getBestFormat, modelToString} from '../utils';
import {useTensorflowModel} from 'react-native-fast-tflite';
import {useResizePlugin} from 'vision-camera-resize-plugin';
import {Path, Skia, Canvas, SkiaDomView} from '@shopify/react-native-skia';

const StateDrawing: React.FC = () => {
  const canvasRef = React.useRef<SkiaDomView>(null);

  const {hasPermission, requestPermission} = useCameraPermission();

  const model = useTensorflowModel(
    require('../assets/singlepose-thunder-tflite-int8.tflite'),
    delegate,
  );

  const {resize} = useResizePlugin();

  const device = useCameraDevice('front');

  const {width: screenWidth, height: screenHeight} = useWindowDimensions();

  const actualModel = model.state === 'loaded' ? model.model : undefined;

  const [paths, setPaths] = React.useState<CurrentPath[]>([]);

  const format = React.useMemo(() => {
    return device ? getBestFormat(device, 720, 1000) : undefined;
  }, [device]);

  const scaleX = (format?.videoWidth || screenWidth) / screenWidth;

  const updatePaths = React.useMemo(() => {
    return Worklets.createRunInJsFn(
      (
        coordinates: {
          x1: number;
          y1: number;
          x2: number;
          y2: number;
        },
        isClear = false,
      ) => {
        setPaths(currentPaths => {
          if (isClear) {
            return [];
          } else {
            const newPath = Skia.Path.Make();
            newPath.moveTo(coordinates.x1, coordinates.y1);
            newPath.lineTo(coordinates.x2, coordinates.y2);
            return [...currentPaths, {path: newPath}];
          }
        });
      },
    );
  }, []);

  const inputTensor = model.model?.inputs[0];

  const inputWidth = inputTensor?.shape[1] ?? 0;
  const inputHeight = inputTensor?.shape[2] ?? 0;

  const dataType = inputTensor?.dataType ?? 'uint8';

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (actualModel == null) {
        return;
      }
      const resized = resize(frame, {
        //@ts-expect-error type mismatch
        dataType: dataType,
        size: {
          width: inputWidth,
          height: inputHeight,
        },
        pixelFormat: 'rgb',
      });
      const typedArray = new Uint8Array(resized);
      const result = actualModel.runSync([typedArray]);

      const output = result[0] as unknown as number[];

      updatePaths({} as any, true);

      for (let i = 0; i < JointsConnection.length; i += 2) {
        const from = JointsConnection[i] * 3;
        const to = JointsConnection[i + 1] * 3;

        const confidence = output[from + 2];

        if (confidence > MIN_CONFIDENCE) {
          const y1 = output[from] * screenHeight;
          const x1 = output[from + 1] * screenWidth;

          const y2 = output[to] * screenHeight;
          const x2 = output[to + 1] * screenWidth;

          updatePaths({x1, y1, x2, y2});
        }
      }
    },
    [actualModel, screenWidth, screenHeight],
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
    <View style={styles.container}>
      {hasPermission && device != null ? (
        <React.Fragment>
          <Canvas ref={canvasRef} style={styles.canvas}>
            {paths.map((path, index) => {
              return (
                <Path
                  key={index}
                  style="stroke"
                  path={path.path}
                  color={path.color || '#000000'}
                  strokeWidth={path.strokeWidth || LINE_WIDTH * scaleX}
                />
              );
            })}
          </Canvas>
          <Camera
            isActive
            fps={20}
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

export default StateDrawing;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {...StyleSheet.absoluteFillObject, zIndex: 1},
});
