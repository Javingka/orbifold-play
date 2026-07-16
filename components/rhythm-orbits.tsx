// SPDX-License-Identifier: AGPL-3.0-only
import { Canvas, Circle, Group, Rect, SweepGradient, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

export interface RhythmOrbitLayer {
  id: string;
  label: string;
  color: string;
  steps: readonly number[];
}

interface RhythmOrbitsProps {
  layers: readonly RhythmOrbitLayer[];
  isPlaying: boolean;
  getPhase: () => number | null;
  onToggleStep: (layerIndex: number, stepIndex: number) => void;
}

export function RhythmOrbits({ layers, isPlaying, getPhase, onToggleStep }: RhythmOrbitsProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [phase, setPhase] = useState(0);

  const handleLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  useEffect(() => {
    if (!isPlaying) {
      setPhase(0);
      return undefined;
    }
    const timer = setInterval(() => {
      const schedulerPhase = getPhase();
      if (schedulerPhase !== null) setPhase(schedulerPhase);
    }, 32);
    return () => clearInterval(timer);
  }, [getPhase, isPlaying]);

  const center = { x: size.width / 2, y: size.height / 2 };
  const outerRadius = Math.min(size.width, size.height) * 0.38;
  const geometry = useMemo(
    () =>
      layers.map((layer, layerIndex) => {
        const radius = outerRadius - layerIndex * Math.max(34, outerRadius * 0.22);
        return {
          layer,
          radius,
          points: layer.steps.map((_, stepIndex) => {
            const angle = (stepIndex / layer.steps.length) * Math.PI * 2 - Math.PI / 2;
            return {
              x: center.x + Math.cos(angle) * radius,
              y: center.y + Math.sin(angle) * radius,
            };
          }),
        };
      }),
    [center.x, center.y, layers, outerRadius],
  );

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={size.width} height={size.height}>
          <SweepGradient
            c={vec(center.x, center.y)}
            colors={['#050609', '#11101a', '#071318', '#050609']}
          />
        </Rect>
        {geometry.map(({ layer, radius, points }) => {
          const currentStep = Math.floor(phase * layer.steps.length) % layer.steps.length;
          return (
            <Group key={layer.id}>
              <Circle
                cx={center.x}
                cy={center.y}
                r={radius}
                color={layer.color}
                style="stroke"
                strokeWidth={1}
                opacity={0.3}
              />
              {points.map((point, stepIndex) => {
                const active = layer.steps[stepIndex] === 1;
                const current = isPlaying && stepIndex === currentStep;
                return (
                  <Group key={stepIndex}>
                    {current ? (
                      <Circle
                        cx={point.x}
                        cy={point.y}
                        r={active ? 11 : 8}
                        color="#ffffff"
                        style="stroke"
                        strokeWidth={1.5}
                        opacity={0.8}
                      />
                    ) : null}
                    <Circle
                      cx={point.x}
                      cy={point.y}
                      r={active ? 6.5 : 3.2}
                      color={active ? layer.color : '#526071'}
                      opacity={active ? 1 : 0.55}
                    />
                  </Group>
                );
              })}
            </Group>
          );
        })}
        <Circle cx={center.x} cy={center.y} r={4} color={isPlaying ? '#f7f8ff' : '#697184'} />
      </Canvas>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {geometry.flatMap(({ layer, points }, layerIndex) =>
          points.map((point, stepIndex) => (
            <Pressable
              key={`${layer.id}:${stepIndex}`}
              accessibilityLabel={`${layer.label} step ${stepIndex + 1}`}
              accessibilityRole="button"
              onPress={() => onToggleStep(layerIndex, stepIndex)}
              style={[
                styles.stepTarget,
                {
                  left: point.x - 21,
                  top: point.y - 21,
                },
              ]}
            />
          )),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 280,
  },
  stepTarget: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
  },
});
