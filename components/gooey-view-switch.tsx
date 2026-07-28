// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from the ReactICX Gooey Switch for Orbifold's Harmony/Rhythm views.
import {
  Blur,
  Canvas,
  Circle,
  ColorMatrix,
  Group,
  Oval,
  Paint,
  RoundedRect,
} from '@shopify/react-native-skia';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  interpolate,
  interpolateColor,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface GooeyViewSwitchProps {
  activeColors?: readonly [string, string];
  accessibilityLabel?: string;
  labels?: readonly [string, string];
  onToggle: (rhythmActive: boolean) => void;
  rhythmActive: boolean;
}

const WIDTH = 72;
const HEIGHT = 40;
const LEFT_X = 21;
const RIGHT_X = 51;
const RADIUS = 14;

export function GooeyViewSwitch({
  activeColors = ['#f3b15a', '#56cfc4'],
  accessibilityLabel,
  labels = ['H', 'R'],
  onToggle,
  rhythmActive,
}: GooeyViewSwitchProps) {
  const progress = useSharedValue(rhythmActive ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(rhythmActive ? 1 : 0, {
      damping: 15,
      mass: 0.7,
      stiffness: 150,
    });
  }, [progress, rhythmActive]);

  const centerX = useDerivedValue(() => interpolate(progress.value, [0, 1], [LEFT_X, RIGHT_X]));
  const radiusX = useDerivedValue(
    () => RADIUS * interpolate(progress.value, [0, 0.5, 1], [1, 1.28, 1]),
  );
  const radiusY = useDerivedValue(
    () => RADIUS * interpolate(progress.value, [0, 0.5, 1], [1, 0.82, 1]),
  );
  const ovalX = useDerivedValue(() => centerX.value - radiusX.value);
  const ovalY = useDerivedValue(() => HEIGHT / 2 - radiusY.value);
  const ovalWidth = useDerivedValue(() => radiusX.value * 2);
  const ovalHeight = useDerivedValue(() => radiusY.value * 2);
  const activeColor = useDerivedValue(() =>
    interpolateColor(progress.value, [0, 1], activeColors),
  );

  const colorMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 30, -13];

  return (
    <Pressable
      accessibilityLabel={
        accessibilityLabel ??
        (rhythmActive ? 'Switch to Harmony view' : 'Switch to Rhythm view')
      }
      accessibilityRole="switch"
      accessibilityState={{ checked: rhythmActive }}
      hitSlop={8}
      onPress={() => onToggle(!rhythmActive)}
      style={styles.container}
    >
      <Canvas pointerEvents="none" style={styles.canvas}>
        <Group
          layer={
            <Paint>
              <Blur blur={3.2} />
              <ColorMatrix matrix={colorMatrix} />
            </Paint>
          }
        >
          <Circle cx={LEFT_X} cy={HEIGHT / 2} r={10.5} color="#272d38" />
          <Circle cx={RIGHT_X} cy={HEIGHT / 2} r={10.5} color="#272d38" />
          <RoundedRect
            x={LEFT_X}
            y={HEIGHT / 2 - 5}
            width={RIGHT_X - LEFT_X}
            height={10}
            r={5}
            color="#272d38"
          />
          <Oval x={ovalX} y={ovalY} width={ovalWidth} height={ovalHeight} color="#353d4b" />
        </Group>
        <Oval x={ovalX} y={ovalY} width={ovalWidth} height={ovalHeight} color={activeColor} />
      </Canvas>
      <View pointerEvents="none" style={styles.labels}>
        <Text style={[styles.label, !rhythmActive && styles.activeLabel]}>{labels[0]}</Text>
        <Text style={[styles.label, rhythmActive && styles.activeLabel]}>{labels[1]}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { width: WIDTH, height: HEIGHT, justifyContent: 'center' },
  canvas: { position: 'absolute', inset: 0 },
  labels: {
    position: 'absolute',
    inset: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  label: { color: '#687184', fontSize: 9, fontWeight: '900' },
  activeLabel: { color: '#08090c' },
});
