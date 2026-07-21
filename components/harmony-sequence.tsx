// SPDX-License-Identifier: AGPL-3.0-only
import {
  BlurMask,
  Canvas,
  LinearGradient,
  Rect,
  RoundedRect,
  SweepGradient,
  useClock,
  vec,
} from '@shopify/react-native-skia';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';

import type { FiniteTonnetzFace } from '@/packages/music-core/src/finite-tonnetz';
import {
  resolveHarmonyPlayhead,
  type HarmonyPlayhead,
} from '@/packages/music-core/src/harmony-playhead';
import type { ScaleMode } from '@/packages/music-core/src/scales';
import { resolveFluidTonnetzMaterial } from '@/packages/ui-core/src/fluid-tonnetz';

interface HarmonySequenceProps {
  getCycle: () => number | null;
  isPlaying: boolean;
  labelFor: (face: FiniteTonnetzFace) => string;
  onClear: () => void;
  onRemove: (index: number) => void;
  scaleMode: ScaleMode;
  scaleRootPc: number;
  sequence: readonly FiniteTonnetzFace[];
}

const CHIP_STRIDE = 71;
const CHIP_WIDTH = 64;
const CHIP_HEIGHT = 34;

interface SequenceStripSurfaceProps {
  clock: SharedValue<number>;
  playhead: HarmonyPlayhead | null;
  scaleMode: ScaleMode;
  scaleRootPc: number;
  sequence: readonly FiniteTonnetzFace[];
}

function SequenceStripSurface({
  clock,
  playhead,
  scaleMode,
  scaleRootPc,
  sequence,
}: SequenceStripSurfaceProps) {
  const radiantStart = useDerivedValue(() => ((clock.value % 3200) / 3200) * 360);
  const radiantEnd = useDerivedValue(() => radiantStart.value + 360);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        {sequence.map((face, index) => {
          const active = playhead?.activeIndex === index;
          const next = sequence.length > 1 && playhead?.nextIndex === index;
          const phase = active && playhead ? playhead.phase : 0;
          const x = index * CHIP_STRIDE;
          const material = resolveFluidTonnetzMaterial(face, scaleRootPc, scaleMode, true);
          const radians = (material.gradientAngle * Math.PI) / 180;
          const radius = CHIP_WIDTH * 0.56;
          const center = vec(x + CHIP_WIDTH / 2, CHIP_HEIGHT / 2);
          const gradientStart = vec(
            center.x - Math.cos(radians) * radius,
            center.y - Math.sin(radians) * radius,
          );
          const gradientEnd = vec(
            center.x + Math.cos(radians) * radius,
            center.y + Math.sin(radians) * radius,
          );

          return (
            <React.Fragment key={`${face.id}:${index}:surface`}>
              <RoundedRect height={CHIP_HEIGHT} r={17} width={CHIP_WIDTH} x={x} y={0}>
                <LinearGradient
                  colors={[...material.colors]}
                  end={gradientEnd}
                  positions={[0, 0.54, 1]}
                  start={gradientStart}
                />
              </RoundedRect>
              <RoundedRect
                color={material.edgeColor}
                height={CHIP_HEIGHT - 2}
                opacity={active ? 0.96 : next ? 0.72 : 0.48}
                r={16}
                strokeWidth={active ? 2 : 1}
                style="stroke"
                width={CHIP_WIDTH - 2}
                x={x + 1}
                y={1}
              />
              {active ? (
                <>
                  <RoundedRect
                    height={CHIP_HEIGHT - 4}
                    opacity={0.72}
                    r={15}
                    strokeWidth={7}
                    style="stroke"
                    width={CHIP_WIDTH - 4}
                    x={x + 2}
                    y={2}
                  >
                    <SweepGradient
                      c={center}
                      colors={[
                        material.colors[2],
                        material.colors[1],
                        '#FFFFFF',
                        material.colors[2],
                      ]}
                      end={radiantEnd}
                      positions={[0, 0.42, 0.55, 1]}
                      start={radiantStart}
                    />
                    <BlurMask blur={4} style="normal" />
                  </RoundedRect>
                  <RoundedRect
                    height={CHIP_HEIGHT - 3}
                    r={15.5}
                    strokeWidth={1.7}
                    style="stroke"
                    width={CHIP_WIDTH - 3}
                    x={x + 1.5}
                    y={1.5}
                  >
                    <SweepGradient
                      c={center}
                      colors={[
                        material.colors[2],
                        material.colors[1],
                        '#FFFFFF',
                        material.colors[2],
                      ]}
                      end={radiantEnd}
                      positions={[0, 0.42, 0.55, 1]}
                      start={radiantStart}
                    />
                  </RoundedRect>
                  <Rect
                    color="rgba(5, 6, 9, 0.42)"
                    height={2}
                    width={CHIP_WIDTH - 10}
                    x={x + 5}
                    y={CHIP_HEIGHT - 5}
                  />
                  <Rect
                    color="#FFFFFF"
                    height={2}
                    opacity={0.94}
                    width={(CHIP_WIDTH - 10) * phase}
                    x={x + 5}
                    y={CHIP_HEIGHT - 5}
                  />
                </>
              ) : null}
            </React.Fragment>
          );
        })}
      </Canvas>
    </View>
  );
}

export function HarmonySequence({
  getCycle,
  isPlaying,
  labelFor,
  onClear,
  onRemove,
  scaleMode,
  scaleRootPc,
  sequence,
}: HarmonySequenceProps) {
  const [playhead, setPlayhead] = useState<HarmonyPlayhead | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const clock = useClock();

  useEffect(() => {
    if (!isPlaying || sequence.length === 0) {
      setPlayhead(null);
      return;
    }

    const update = (): void => {
      const cycle = getCycle();
      setPlayhead(cycle === null ? null : resolveHarmonyPlayhead(cycle, sequence.length));
    };

    update();
    const timer = setInterval(update, 32);
    return () => clearInterval(timer);
  }, [getCycle, isPlaying, sequence.length]);

  useEffect(() => {
    if (playhead === null) return;
    scrollRef.current?.scrollTo({
      animated: true,
      x: Math.max(0, playhead.activeIndex * CHIP_STRIDE - CHIP_STRIDE),
    });
  }, [playhead?.activeIndex]);

  return (
    <View style={styles.panel}>
      <ScrollView
        ref={scrollRef}
        horizontal
        contentContainerStyle={styles.content}
        showsHorizontalScrollIndicator={false}
      >
        {sequence.length === 0 ? (
          <Text style={styles.empty}>YOUR CHORD SEQUENCE</Text>
        ) : (
          <View
            style={[
              styles.sequenceStrip,
              { width: sequence.length * CHIP_STRIDE - (CHIP_STRIDE - CHIP_WIDTH) },
            ]}
          >
            <SequenceStripSurface
              clock={clock}
              playhead={playhead}
              scaleMode={scaleMode}
              scaleRootPc={scaleRootPc}
              sequence={sequence}
            />
            {sequence.map((face, index) => {
              const isActive = playhead?.activeIndex === index;
              const isNext = sequence.length > 1 && playhead?.nextIndex === index;
              const label = labelFor(face);

              return (
                <Pressable
                  key={`${face.id}:${index}`}
                  accessibilityLabel={`${label}, position ${index + 1}${
                    isActive ? ', currently playing' : isNext ? ', plays next' : ''
                  }. Tap to remove.`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => onRemove(index)}
                  style={[styles.chip, { left: index * CHIP_STRIDE }]}
                >
                  <Text
                    style={[styles.index, isNext && styles.nextText, isActive && styles.activeText]}
                  >
                    {isActive ? 'NOW' : isNext ? 'NEXT' : index + 1}
                  </Text>
                  <Text style={[styles.label, isActive && styles.activeText]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      {sequence.length > 0 ? (
        <Pressable accessibilityRole="button" onPress={onClear} style={styles.clearButton}>
          <Text style={styles.clearText}>CLEAR</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 8,
  },
  content: { alignItems: 'center', paddingRight: 4 },
  empty: { color: '#4f5768', fontSize: 9, fontWeight: '700', letterSpacing: 1.4 },
  chip: {
    position: 'absolute',
    width: 64,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    overflow: 'hidden',
    paddingHorizontal: 7,
    borderRadius: 17,
    backgroundColor: 'transparent',
  },
  sequenceStrip: { height: CHIP_HEIGHT, position: 'relative' },
  index: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 7,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  label: { color: '#f7f8ff', fontSize: 12, fontWeight: '700' },
  nextText: { color: '#FFFFFF' },
  activeText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.82)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  clearButton: { paddingHorizontal: 8, paddingVertical: 9 },
  clearText: { color: '#e87bac', fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
});
