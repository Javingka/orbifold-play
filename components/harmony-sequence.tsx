// SPDX-License-Identifier: AGPL-3.0-only
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { FiniteTonnetzFace } from '@/packages/music-core/src/finite-tonnetz';
import {
  resolveHarmonyPlayhead,
  type HarmonyPlayhead,
} from '@/packages/music-core/src/harmony-playhead';

interface HarmonySequenceProps {
  getCycle: () => number | null;
  isPlaying: boolean;
  labelFor: (face: FiniteTonnetzFace) => string;
  onClear: () => void;
  onRemove: (index: number) => void;
  sequence: readonly FiniteTonnetzFace[];
}

const CHIP_STRIDE = 71;

export function HarmonySequence({
  getCycle,
  isPlaying,
  labelFor,
  onClear,
  onRemove,
  sequence,
}: HarmonySequenceProps) {
  const [playhead, setPlayhead] = useState<HarmonyPlayhead | null>(null);
  const scrollRef = useRef<ScrollView>(null);

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
          sequence.map((face, index) => {
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
                style={[styles.chip, isNext && styles.nextChip, isActive && styles.activeChip]}
              >
                <Text
                  style={[styles.index, isNext && styles.nextText, isActive && styles.activeText]}
                >
                  {isActive ? 'NOW' : isNext ? 'NEXT' : index + 1}
                </Text>
                <Text style={[styles.label, isActive && styles.activeText]}>{label}</Text>
                {isActive && playhead ? (
                  <View pointerEvents="none" style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${playhead.phase * 100}%` }]} />
                  </View>
                ) : null}
              </Pressable>
            );
          })
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
  content: { alignItems: 'center', gap: 7, paddingRight: 4 },
  empty: { color: '#4f5768', fontSize: 9, fontWeight: '700', letterSpacing: 1.4 },
  chip: {
    width: 64,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    overflow: 'hidden',
    paddingHorizontal: 7,
    borderRadius: 17,
    backgroundColor: '#151923',
    borderWidth: 1,
    borderColor: '#303849',
  },
  nextChip: { borderColor: '#596da8', backgroundColor: '#171c2a' },
  activeChip: { borderColor: '#f3b15a', backgroundColor: '#3b2b19' },
  index: { color: '#697184', fontSize: 7, fontWeight: '800' },
  label: { color: '#f7f8ff', fontSize: 12, fontWeight: '700' },
  nextText: { color: '#8aa0ff' },
  activeText: { color: '#ffd08e' },
  progressTrack: {
    position: 'absolute',
    right: 5,
    bottom: 3,
    left: 5,
    height: 2,
    overflow: 'hidden',
    borderRadius: 1,
    backgroundColor: '#5c462c',
  },
  progressFill: { height: 2, borderRadius: 1, backgroundColor: '#f3b15a' },
  clearButton: { paddingHorizontal: 8, paddingVertical: 9 },
  clearText: { color: '#e87bac', fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
});
