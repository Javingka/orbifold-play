// SPDX-License-Identifier: AGPL-3.0-only
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AsyncSkia } from '@/components/async-skia';
import { StackedChips } from '@/components/stacked-chips';
import type { RhythmOrbitLayer } from '@/components/rhythm-orbits';
import { playStrudel, prepareStrudelAudio, stopStrudel } from '@/packages/audio/src/strudel-engine';
import { bjorklund } from '@/packages/music-core/src/euclidean';
import type { FiniteTonnetzFace } from '@/packages/music-core/src/finite-tonnetz';
import {
  buildPlayablePattern,
  type PlayableRhythmLayer,
} from '@/packages/music-core/src/playable-code';

const TonnetzArtifact = React.lazy(async () => {
  const module = await import('@/components/tonnetz-artifact');
  return { default: module.TonnetzArtifact };
});
const RhythmOrbits = React.lazy(async () => {
  const module = await import('@/components/rhythm-orbits');
  return { default: module.RhythmOrbits };
});

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;
const BPM = 120;

type InstrumentView = 'harmony' | 'rhythm';
type TransportState = 'idle' | 'loading' | 'playing' | 'error';
type AppRhythmLayer = RhythmOrbitLayer & Omit<PlayableRhythmLayer, 'steps'>;

const INITIAL_RHYTHM_LAYERS: readonly AppRhythmLayer[] = [
  {
    id: 'pulse',
    label: 'Pulse',
    color: '#f3b15a',
    steps: bjorklund(4, 16),
    instrument: 'sine',
    note: 'c2',
    gain: 0.52,
    decay: 0.12,
    lpf: 900,
  },
  {
    id: 'click',
    label: 'Click',
    color: '#56cfc4',
    steps: bjorklund(5, 12),
    instrument: 'square',
    note: 'g4',
    gain: 0.16,
    decay: 0.045,
    lpf: 2600,
  },
  {
    id: 'air',
    label: 'Air',
    color: '#e87bac',
    steps: bjorklund(3, 8),
    instrument: 'white',
    note: 'c6',
    gain: 0.08,
    decay: 0.035,
    lpf: 6200,
  },
];

interface PlaybackSnapshot {
  selected: FiniteTonnetzFace | null;
  harmonyEnabled: boolean;
  rhythmEnabled: boolean;
  layers: readonly AppRhythmLayer[];
}

export default function Page() {
  const [view, setView] = useState<InstrumentView>('harmony');
  const [selected, setSelected] = useState<FiniteTonnetzFace | null>(null);
  const [rhythmLayers, setRhythmLayers] = useState(INITIAL_RHYTHM_LAYERS);
  const [harmonyEnabled, setHarmonyEnabled] = useState(false);
  const [rhythmEnabled, setRhythmEnabled] = useState(false);
  const [transport, setTransport] = useState<TransportState>('idle');
  const [audioError, setAudioError] = useState<string | null>(null);
  const playbackRequest = useRef(0);

  useEffect(() => {
    prepareStrudelAudio();
    return () => stopStrudel();
  }, []);

  const applyPlayback = useCallback(async (snapshot: PlaybackSnapshot): Promise<void> => {
    const request = ++playbackRequest.current;
    const code = buildPlayablePattern({
      ...(snapshot.harmonyEnabled && snapshot.selected
        ? {
            chord: {
              rootPc: snapshot.selected.rootPc,
              quality: snapshot.selected.quality,
            },
          }
        : {}),
      ...(snapshot.rhythmEnabled
        ? {
            rhythmLayers: snapshot.layers.map((layer) => ({
              steps: layer.steps,
              instrument: layer.instrument,
              note: layer.note,
              gain: layer.gain,
              decay: layer.decay,
              lpf: layer.lpf,
            })),
          }
        : {}),
    });

    if (code === 'silence') {
      stopStrudel();
      setTransport('idle');
      return;
    }

    setAudioError(null);
    setTransport('loading');
    const result = await playStrudel(code, BPM);
    if (request !== playbackRequest.current) return;

    if (result.ok) {
      setTransport('playing');
    } else {
      setAudioError(result.error ?? 'Unknown audio error');
      setTransport('error');
    }
  }, []);

  const handleChordSelect = (face: FiniteTonnetzFace): void => {
    setSelected(face);
    setHarmonyEnabled(true);
    void Haptics.selectionAsync();
    void applyPlayback({
      selected: face,
      harmonyEnabled: true,
      rhythmEnabled,
      layers: rhythmLayers,
    });
  };

  const handleToggleStep = (layerIndex: number, stepIndex: number): void => {
    const nextLayers = rhythmLayers.map((layer, currentLayerIndex) => {
      if (currentLayerIndex !== layerIndex) return layer;
      const steps = [...layer.steps];
      steps[stepIndex] = steps[stepIndex] === 1 ? 0 : 1;
      return { ...layer, steps };
    });

    setRhythmLayers(nextLayers);
    setRhythmEnabled(true);
    void Haptics.selectionAsync();
    void applyPlayback({
      selected,
      harmonyEnabled,
      rhythmEnabled: true,
      layers: nextLayers,
    });
  };

  const handleStop = (): void => {
    playbackRequest.current += 1;
    stopStrudel();
    setHarmonyEnabled(false);
    setRhythmEnabled(false);
    setAudioError(null);
    setTransport('idle');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  };

  const chordLabel = selected
    ? `${NOTE_NAMES[selected.rootPc]}${selected.quality === 'min' ? 'm' : ''}`
    : 'Touch a face';
  const rhythmLabel = rhythmLayers
    .map((layer) => `E(${layer.steps.filter(Boolean).length},${layer.steps.length})`)
    .join(' · ');
  const otherView: InstrumentView = view === 'harmony' ? 'rhythm' : 'harmony';
  const stopEnabled = transport === 'loading' || transport === 'playing';
  const transportLabel =
    transport === 'loading'
      ? 'STARTING AUDIO…'
      : transport === 'error'
        ? `AUDIO ERROR · ${audioError ?? 'TRY AGAIN'}`
        : transport === 'playing'
          ? `${harmonyEnabled ? 'HARMONY' : ''}${harmonyEnabled && rhythmEnabled ? ' + ' : ''}${rhythmEnabled ? 'RHYTHM' : ''} PLAYING`
          : view === 'harmony'
            ? 'TAP A TRIANGLE TO PLAY'
            : 'TAP A STEP TO PLAY';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ORBIFOLD / PLAY</Text>
          <Text style={styles.title}>
            {view === 'harmony' ? 'Harmonic object' : 'Rhythm orbits'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!stopEnabled}
          onPress={handleStop}
          style={[styles.stopButton, !stopEnabled && styles.stopButtonDisabled]}
        >
          <View style={styles.stopIcon} />
          <Text style={styles.stopText}>STOP</Text>
        </Pressable>
      </View>

      <View style={styles.transportLine}>
        <View
          style={[
            styles.transportDot,
            transport === 'playing' && styles.transportDotPlaying,
            transport === 'error' && styles.transportDotError,
          ]}
        />
        <Text style={styles.transportText}>{transportLabel}</Text>
      </View>

      <View style={styles.stage}>
        <React.Suspense fallback={<ActivityIndicator color="#8aa0ff" size="large" />}>
          <AsyncSkia />
          {view === 'harmony' ? (
            <TonnetzArtifact selectedId={selected?.id ?? null} onSelect={handleChordSelect} />
          ) : (
            <RhythmOrbits
              bpm={BPM}
              isPlaying={transport === 'playing' && rhythmEnabled}
              layers={rhythmLayers}
              onToggleStep={handleToggleStep}
            />
          )}
        </React.Suspense>
      </View>

      <View style={styles.readout}>
        <Text style={styles.readoutValue}>{view === 'harmony' ? chordLabel : rhythmLabel}</Text>
        <Text style={styles.readoutHint}>
          {view === 'harmony' ? '24 PLAYABLE TRIADS' : `${BPM} BPM · TOUCH THE ORBITS`}
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
    borderColor: '#4a3040',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stopButtonDisabled: { opacity: 0.38 },
  stopIcon: { width: 7, height: 7, borderRadius: 1, backgroundColor: '#e87bac' },
  stopText: { color: '#c9ceda', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  transportLine: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 7,
  },
  transportDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#697184' },
  transportDotPlaying: { backgroundColor: '#56cfc4' },
  transportDotError: { backgroundColor: '#e87bac' },
  transportText: { color: '#7f889c', fontSize: 9, fontWeight: '700', letterSpacing: 1.25 },
  stage: { flex: 1, minHeight: 280 },
  readout: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8 },
  readoutValue: {
    color: '#f7f8ff',
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  readoutHint: {
    color: '#697184',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginTop: 5,
    textAlign: 'center',
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
