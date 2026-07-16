// SPDX-License-Identifier: AGPL-3.0-only
import { Canvas, Circle, Group, Rect, SweepGradient, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';

const ORBITS = [
  { steps: 16, hits: new Set([0, 4, 8, 12]), color: '#f3b15a' },
  { steps: 12, hits: new Set([0, 3, 6, 9]), color: '#56cfc4' },
  { steps: 8, hits: new Set([2, 6]), color: '#e87bac' },
] as const;

export function RhythmOrbits() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const center = { x: size.width / 2, y: size.height / 2 };
  const outerRadius = Math.min(size.width, size.height) * 0.38;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={size.width} height={size.height}>
          <SweepGradient
            c={vec(center.x, center.y)}
            colors={['#050609', '#11101a', '#071318', '#050609']}
          />
        </Rect>
        {ORBITS.map((orbit, orbitIndex) => {
          const radius = outerRadius - orbitIndex * Math.max(34, outerRadius * 0.22);
          return (
            <Group key={orbit.steps}>
              <Circle
                cx={center.x}
                cy={center.y}
                r={radius}
                color={orbit.color}
                style="stroke"
                strokeWidth={1}
                opacity={0.24}
              />
              {Array.from({ length: orbit.steps }, (_, step) => {
                const angle = (step / orbit.steps) * Math.PI * 2 - Math.PI / 2;
                const active = orbit.hits.has(step);
                return (
                  <Circle
                    key={step}
                    cx={center.x + Math.cos(angle) * radius}
                    cy={center.y + Math.sin(angle) * radius}
                    r={active ? 6.5 : 2.8}
                    color={active ? orbit.color : '#526071'}
                    opacity={active ? 0.95 : 0.5}
                  />
                );
              })}
            </Group>
          );
        })}
        <Circle cx={center.x} cy={center.y} r={4} color="#f7f8ff" />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 280,
  },
});
