// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from 'react';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsyncSkia } from '@/components/async-skia';
import { StackedChips } from '@/components/stacked-chips';
import type { FiniteTonnetzFace } from '@/packages/music-core/src/finite-tonnetz';

const TonnetzArtifact = React.lazy(async () => {
  const module = await import('@/components/tonnetz-artifact');
  return { default: module.TonnetzArtifact };
});
const RhythmOrbits = React.lazy(async () => {
  const module = await import('@/components/rhythm-orbits');
  return { default: module.RhythmOrbits };
});

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;
type InstrumentView = 'harmony' | 'rhythm';

export default function Page() {
  const [view, setView] = useState<InstrumentView>('harmony');
  const [selected, setSelected] = useState<FiniteTonnetzFace | null>(null);
  const chordLabel = selected
    ? `${NOTE_NAMES[selected.rootPc]}${selected.quality === 'min' ? 'm' : ''}`
    : 'Touch a face';

  const otherView: InstrumentView = view === 'harmony' ? 'rhythm' : 'harmony';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ORBIFOLD / PLAY</Text>
          <Text style={styles.title}>
            {view === 'harmony' ? 'Harmonic object' : 'Rhythm orbits'}
          </Text>
        </View>
        <Pressable accessibilityRole="button" disabled style={styles.stopButton}>
          <View style={styles.stopIcon} />
          <Text style={styles.stopText}>STOP</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>
        <React.Suspense fallback={<ActivityIndicator color="#8aa0ff" size="large" />}>
          <AsyncSkia />
          {view === 'harmony' ? (
            <TonnetzArtifact selectedId={selected?.id ?? null} onSelect={setSelected} />
          ) : (
            <RhythmOrbits />
          )}
        </React.Suspense>
      </View>

      <View style={styles.readout}>
        <Text style={styles.readoutValue}>
          {view === 'harmony' ? chordLabel : 'E(4,16) · 120 BPM'}
        </Text>
        <Text style={styles.readoutHint}>
          {view === 'harmony' ? '24 UNIQUE TRIADS' : '3 ORBITS · AUDIO ENGINE NEXT'}
        </Text>
      </View>

      <View style={styles.controls}>
        <StackedChips>
          <StackedChips.Trigger>
            <View style={[styles.chip, styles.primaryChip]}>
              <Text style={[styles.chipText, styles.primaryChipText]}>
                {view === 'harmony' ? 'HARMONY' : 'RHYTHM'}
              </Text>
              <Text style={[styles.chipText, styles.primaryChipText]}>＋</Text>
            </View>
          </StackedChips.Trigger>
          <StackedChips.Content>
            <Pressable
              accessibilityRole="button"
              onPress={() => setView(otherView)}
              style={[styles.chip, styles.secondaryChip]}
            >
              <Text style={styles.chipText}>{otherView.toUpperCase()}</Text>
            </Pressable>
          </StackedChips.Content>
        </StackedChips>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: '100%',
    backgroundColor: '#050609',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
  },
  eyebrow: {
    color: '#707a8f',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.2,
  },
  title: {
    color: '#f7f8ff',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderColor: '#2a2e38',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    opacity: 0.55,
  },
  stopIcon: { width: 7, height: 7, borderRadius: 1, backgroundColor: '#e87bac' },
  stopText: { color: '#c9ceda', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  stage: { flex: 1, minHeight: 300 },
  readout: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8 },
  readoutValue: { color: '#f7f8ff', fontSize: 28, fontWeight: '300', letterSpacing: -1 },
  readoutHint: {
    color: '#697184',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginTop: 5,
  },
  controls: { alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    borderRadius: 999,
    paddingHorizontal: 18,
  },
  primaryChip: { backgroundColor: '#f7f8ff', minWidth: 132 },
  secondaryChip: { backgroundColor: '#20242d', marginLeft: 12, minWidth: 124 },
  chipText: { color: '#f7f8ff', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  primaryChipText: { color: '#08090c' },
});
