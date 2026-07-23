// SPDX-License-Identifier: AGPL-3.0-only
import {
  BlurMask,
  Canvas,
  Group,
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

import {
  HarmonyDurationEditor,
  HarmonyDurationMarkers,
} from '@/components/harmony-duration-editor';
import type { FiniteTonnetzFace } from '@/packages/music-core/src/finite-tonnetz';
import type { HarmonyDuration } from '@/packages/music-core/src/harmony-duration';
import {
  resolveHarmonyPlayhead,
  type HarmonyPlayhead,
} from '@/packages/music-core/src/harmony-playhead';
import type { HarmonySequenceEntry } from '@/packages/music-core/src/harmony-sequence';
import type { ScaleMode } from '@/packages/music-core/src/scales';
import { resolveFluidTonnetzMaterial } from '@/packages/ui-core/src/fluid-tonnetz';

interface HarmonySequenceProps {
  getCycle: () => number | null;
  isPlaying: boolean;
  labelFor: (face: FiniteTonnetzFace) => string;
  onClear: () => void;
  onDurationChange: (index: number, duration: HarmonyDuration) => void;
  onMuteToggle: (index: number) => void;
  onRemove: (index: number) => void;
  scaleMode: ScaleMode;
  scaleRootPc: number;
  sequence: readonly HarmonySequenceEntry[];
}

const CHIP_STRIDE = 71;
const CHIP_WIDTH = 64;
const CHIP_HEIGHT = 34;

interface SequenceStripSurfaceProps {
  clock: SharedValue<number>;
  playhead: HarmonyPlayhead | null;
  scaleMode: ScaleMode;
  scaleRootPc: number;
  sequence: readonly HarmonySequenceEntry[];
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
        {sequence.map((entry, index) => {
          const { face } = entry;
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
            <Group key={`${face.id}:${index}:surface`} opacity={entry.muted ? 0.28 : 1}>
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
            </Group>
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
  onDurationChange,
  onMuteToggle,
  onRemove,
  scaleMode,
  scaleRootPc,
  sequence,
}: HarmonySequenceProps) {
  const [playhead, setPlayhead] = useState<HarmonyPlayhead | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const clock = useClock();
  const durationKey = sequence.map((entry) => entry.duration).join(':');
  const editingEntry = editingIndex === null ? null : (sequence[editingIndex] ?? null);
  const editingMaterial = editingEntry
    ? resolveFluidTonnetzMaterial(editingEntry.face, scaleRootPc, scaleMode, true)
    : null;

  useEffect(() => {
    if (!isPlaying || sequence.length === 0) {
      setPlayhead(null);
      return;
    }

    const update = (): void => {
      const cycle = getCycle();
      setPlayhead(
        cycle === null
          ? null
          : resolveHarmonyPlayhead(
              cycle,
              sequence.map((entry) => entry.duration),
            ),
      );
    };

    update();
    const timer = setInterval(update, 32);
    return () => clearInterval(timer);
  }, [durationKey, getCycle, isPlaying, sequence.length]);

  useEffect(() => {
    if (playhead === null) return;
    scrollRef.current?.scrollTo({
      animated: true,
      x: Math.max(0, playhead.activeIndex * CHIP_STRIDE - CHIP_STRIDE),
    });
  }, [playhead?.activeIndex]);

  return (
    <View style={[styles.panel, editingEntry && styles.panelEditingStack]}>
      {editingEntry ? (
        <Pressable
          accessibilityLabel="Close chord duration editor"
          accessibilityRole="button"
          onPress={() => setEditingIndex(null)}
          style={styles.dismissBackdrop}
        />
      ) : null}
      <View style={styles.stripRow}>
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
              {sequence.map((entry, index) => {
                const { face } = entry;
                const isActive = playhead?.activeIndex === index;
                const isNext = sequence.length > 1 && playhead?.nextIndex === index;
                const label = labelFor(face);
                const isEditing = editingIndex === index;

                return (
                  <Pressable
                    key={`${face.id}:${index}`}
                    accessibilityLabel={`${label}, ${entry.duration} ${
                      entry.duration === 1 ? 'bar' : 'bars'
                    }${entry.muted ? ', muted' : ''}, position ${index + 1}${
                      isActive ? ', currently playing' : isNext ? ', plays next' : ''
                    }. Tap to edit.`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive || isEditing }}
                    onPress={() => setEditingIndex((current) => (current === index ? null : index))}
                    style={[
                      styles.chip,
                      entry.muted && styles.chipMuted,
                      isEditing && styles.chipEditing,
                      { left: index * CHIP_STRIDE },
                    ]}
                  >
                    <Text
                      style={[
                        styles.index,
                        entry.muted && styles.mutedText,
                        isNext && styles.nextText,
                        isActive && styles.activeText,
                      ]}
                    >
                      {isActive ? 'NOW' : isNext ? 'NEXT' : index + 1}
                    </Text>
                    <Text
                      style={[
                        styles.label,
                        entry.muted && styles.mutedText,
                        isActive && styles.activeText,
                      ]}
                    >
                      {label}
                    </Text>
                    <HarmonyDurationMarkers duration={entry.duration} muted={entry.muted} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
        {sequence.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEditingIndex(null);
              onClear();
            }}
            style={styles.clearButton}
          >
            <Text style={styles.clearText}>CLEAR</Text>
          </Pressable>
        ) : null}
      </View>
      {editingEntry && editingMaterial && editingIndex !== null ? (
        <View style={styles.editorOverlay}>
          <HarmonyDurationEditor
            accent={editingMaterial.edgeColor}
            chordLabel={labelFor(editingEntry.face)}
            duration={editingEntry.duration}
            muted={editingEntry.muted}
            onDelete={() => {
              onRemove(editingIndex);
              setEditingIndex(null);
            }}
            onDurationChange={(duration) => onDurationChange(editingIndex, duration)}
            onMuteToggle={() => onMuteToggle(editingIndex)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    height: 48,
    paddingHorizontal: 18,
    gap: 6,
  },
  panelEditingStack: { zIndex: 40 },
  dismissBackdrop: {
    position: 'absolute',
    top: -700,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
  },
  editorOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 46,
    zIndex: 40,
    shadowColor: '#000',
    shadowOpacity: 0.56,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  stripRow: {
    zIndex: 30,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
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
  chipMuted: { opacity: 0.72 },
  chipEditing: { borderWidth: 1.5, borderColor: '#FFFFFF' },
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
  mutedText: { opacity: 0.54 },
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
