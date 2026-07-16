// SPDX-License-Identifier: AGPL-3.0-only
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkiaReady } from '@/components/async-skia';
import { HarmonySequence } from '@/components/harmony-sequence';
import { ParallaxCarousel } from '@/components/parallax-carousel';
import { ScaleBlurCarousel, type ScaleCarouselOption } from '@/components/scale-blur-carousel';
import { StackedChips } from '@/components/stacked-chips';
import { ViewModeIndicator } from '@/components/view-mode-indicator';
import type { RhythmOrbitLayer } from '@/components/rhythm-orbits';
import {
  getStrudelCycle,
  getStrudelPhase,
  playStrudel,
  prepareStrudelAudio,
  stopStrudel,
} from '@/packages/audio/src/strudel-engine';
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
const GooeyViewSwitch = React.lazy(async () => {
  const module = await import('@/components/gooey-view-switch');
  return { default: module.GooeyViewSwitch };
});
const RhythmOrbits = React.lazy(async () => {
  const module = await import('@/components/rhythm-orbits');
  return { default: module.RhythmOrbits };
});

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;
const BPM = 120;
const MAX_SEQUENCE_LENGTH = 16;
const SCALE_OPTIONS: readonly ScaleCarouselOption[] = [
  { id: 'c-major', rootPc: 0, mode: 'major', title: 'C MAJOR', subtitle: 'IONIAN' },
  { id: 'c-minor', rootPc: 0, mode: 'minor', title: 'C MINOR', subtitle: 'AEOLIAN' },
  { id: 'c-dorian', rootPc: 0, mode: 'dorian', title: 'C DORIAN', subtitle: '♭3 · ♮6' },
  { id: 'c-phrygian', rootPc: 0, mode: 'phrygian', title: 'C PHRYGIAN', subtitle: '♭2 · ♭3' },
  { id: 'c-lydian', rootPc: 0, mode: 'lydian', title: 'C LYDIAN', subtitle: '♯4' },
  { id: 'c-mixolydian', rootPc: 0, mode: 'mixolydian', title: 'C MIXOLYD.', subtitle: '♭7' },
  { id: 'c-locrian', rootPc: 0, mode: 'locrian', title: 'C LOCRIAN', subtitle: '♭2 · ♭5' },
  {
    id: 'c-harmonic-minor',
    rootPc: 0,
    mode: 'harmonic:minor',
    title: 'C HARMONIC',
    subtitle: 'MINOR · ♮7',
  },
];

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
  sequence: readonly FiniteTonnetzFace[];
  harmonyIncluded: boolean;
  rhythmIncluded: boolean;
  layers: readonly AppRhythmLayer[];
}

function chordLabel(face: FiniteTonnetzFace): string {
  return `${NOTE_NAMES[face.rootPc]}${face.quality === 'min' ? 'm' : ''}`;
}

export default function Page() {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const instrumentStageHeight = Math.max(270, Math.min(360, screenHeight * 0.43));
  const [view, setView] = useState<InstrumentView>('harmony');
  const [selected, setSelected] = useState<FiniteTonnetzFace | null>(null);
  const [sequence, setSequence] = useState<readonly FiniteTonnetzFace[]>([]);
  const [rhythmLayers, setRhythmLayers] = useState(INITIAL_RHYTHM_LAYERS);
  const [harmonyIncluded, setHarmonyIncluded] = useState(true);
  const [rhythmIncluded, setRhythmIncluded] = useState(true);
  const [selectedScale, setSelectedScale] = useState<ScaleCarouselOption>(
    SCALE_OPTIONS[0] as ScaleCarouselOption,
  );
  const [transport, setTransport] = useState<TransportState>('idle');
  const [audioError, setAudioError] = useState<string | null>(null);
  const playbackRequest = useRef(0);
  const playingRef = useRef(false);
  const viewRef = useRef<InstrumentView>('harmony');

  useEffect(() => {
    prepareStrudelAudio();
    return () => stopStrudel();
  }, []);

  const stopPlayback = useCallback((): void => {
    playbackRequest.current += 1;
    stopStrudel();
    playingRef.current = false;
    setAudioError(null);
    setTransport('idle');
  }, []);

  const applyPlayback = useCallback(
    async (snapshot: PlaybackSnapshot): Promise<void> => {
      const request = ++playbackRequest.current;
      const code = buildPlayablePattern({
        ...(snapshot.harmonyIncluded && snapshot.sequence.length > 0
          ? {
              chords: snapshot.sequence.map((face) => ({
                rootPc: face.rootPc,
                quality: face.quality,
              })),
            }
          : {}),
        ...(snapshot.rhythmIncluded
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
        stopPlayback();
        return;
      }

      const wasPlaying = playingRef.current;
      setAudioError(null);
      if (!wasPlaying) setTransport('loading');
      const result = await playStrudel(code, BPM);
      if (request !== playbackRequest.current) return;

      if (result.ok) {
        playingRef.current = true;
        setTransport('playing');
      } else {
        stopStrudel();
        playingRef.current = false;
        setAudioError(result.error ?? 'Unknown audio error');
        setTransport('error');
      }
    },
    [stopPlayback],
  );

  const currentSnapshot = useCallback(
    (overrides?: Partial<PlaybackSnapshot>): PlaybackSnapshot => ({
      sequence,
      harmonyIncluded,
      rhythmIncluded,
      layers: rhythmLayers,
      ...overrides,
    }),
    [harmonyIncluded, rhythmIncluded, rhythmLayers, sequence],
  );

  const handleTransportToggle = (): void => {
    if (playingRef.current || transport === 'loading') {
      stopPlayback();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      return;
    }
    void applyPlayback(currentSnapshot());
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleChordSelect = (face: FiniteTonnetzFace): void => {
    const nextSequence =
      sequence.length >= MAX_SEQUENCE_LENGTH ? [...sequence.slice(1), face] : [...sequence, face];
    setSelected(face);
    setSequence(nextSequence);
    void Haptics.selectionAsync();
    if (playingRef.current && harmonyIncluded) {
      void applyPlayback(currentSnapshot({ sequence: nextSequence }));
    }
  };

  const handleRemoveChord = (index: number): void => {
    const nextSequence = sequence.filter((_, currentIndex) => currentIndex !== index);
    setSequence(nextSequence);
    setSelected(nextSequence.at(-1) ?? null);
    if (playingRef.current && harmonyIncluded) {
      void applyPlayback(currentSnapshot({ sequence: nextSequence }));
    }
  };

  const handleClearSequence = (): void => {
    setSequence([]);
    setSelected(null);
    if (playingRef.current && harmonyIncluded) {
      void applyPlayback(currentSnapshot({ sequence: [] }));
    }
  };

  const handleToggleStep = (layerIndex: number, stepIndex: number): void => {
    const nextLayers = rhythmLayers.map((layer, currentLayerIndex) => {
      if (currentLayerIndex !== layerIndex) return layer;
      const steps = [...layer.steps];
      steps[stepIndex] = steps[stepIndex] === 1 ? 0 : 1;
      return { ...layer, steps };
    });

    setRhythmLayers(nextLayers);
    void Haptics.selectionAsync();
    if (playingRef.current && rhythmIncluded) {
      void applyPlayback(currentSnapshot({ layers: nextLayers }));
    }
  };

  const handleChannelToggle = (channel: InstrumentView): void => {
    if (channel === 'harmony') {
      const next = !harmonyIncluded;
      setHarmonyIncluded(next);
      if (playingRef.current) {
        void applyPlayback(currentSnapshot({ harmonyIncluded: next }));
      }
    } else {
      const next = !rhythmIncluded;
      setRhythmIncluded(next);
      if (playingRef.current) {
        void applyPlayback(currentSnapshot({ rhythmIncluded: next }));
      }
    }
    void Haptics.selectionAsync();
  };

  const handleViewChange = useCallback((nextView: InstrumentView): void => {
    if (viewRef.current === nextView) return;
    viewRef.current = nextView;
    setView(nextView);
    void Haptics.selectionAsync();
  }, []);

  const handleScaleSelect = useCallback((option: ScaleCarouselOption): void => {
    setSelectedScale((current) => {
      if (current.id === option.id) return current;
      void Haptics.selectionAsync();
      return option;
    });
  }, []);

  const selectedLabel = selected ? chordLabel(selected) : 'Build a sequence';
  const rhythmLabel = rhythmLayers
    .map((layer) => `E(${layer.steps.filter(Boolean).length},${layer.steps.length})`)
    .join(' · ');
  const masterActive = transport === 'loading' || transport === 'playing';
  const soundingHarmony = harmonyIncluded && sequence.length > 0;
  const transportLabel =
    transport === 'loading'
      ? 'STARTING AUDIO…'
      : transport === 'error'
        ? `AUDIO ERROR · ${audioError ?? 'TRY AGAIN'}`
        : transport === 'playing'
          ? `${soundingHarmony ? 'HARMONY' : ''}${soundingHarmony && rhythmIncluded ? ' + ' : ''}${rhythmIncluded ? 'RHYTHM' : ''} PLAYING`
          : sequence.length === 0
            ? 'ADD CHORDS OR PLAY THE RHYTHM'
            : `READY · ${sequence.length} CHORD${sequence.length === 1 ? '' : 'S'}`;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ORBIFOLD / PLAY</Text>
          <Text style={styles.title}>
            {view === 'harmony' ? 'Harmonic object' : 'Rhythm orbits'}
          </Text>
        </View>
        <React.Suspense fallback={<View style={styles.switchFallback} />}>
          <SkiaReady>
            <GooeyViewSwitch
              onToggle={(rhythmActive) => handleViewChange(rhythmActive ? 'rhythm' : 'harmony')}
              rhythmActive={view === 'rhythm'}
            />
          </SkiaReady>
        </React.Suspense>
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

      <View style={styles.carouselArea}>
        <React.Suspense fallback={<ActivityIndicator color="#8aa0ff" size="large" />}>
          <SkiaReady>
            <ParallaxCarousel
              itemWidth={screenWidth}
              onIndexChange={(index) => handleViewChange(index === 0 ? 'harmony' : 'rhythm')}
              pages={[
                {
                  id: 'harmony',
                  content: (
                    <View style={styles.instrumentPage}>
                      <View
                        style={[
                          styles.stage,
                          styles.harmonyStage,
                          { height: instrumentStageHeight },
                        ]}
                      >
                        <ScaleBlurCarousel
                          onSelect={handleScaleSelect}
                          options={SCALE_OPTIONS}
                          selectedId={selectedScale.id}
                        />
                        <View style={styles.hexagonArea}>
                          <TonnetzArtifact
                            selectedId={selected?.id ?? null}
                            scaleMode={selectedScale.mode}
                            scaleRootPc={selectedScale.rootPc}
                            onSelect={handleChordSelect}
                          />
                        </View>
                      </View>
                      <View style={styles.readout}>
                        <Text style={styles.readoutValue}>{selectedLabel}</Text>
                        <Text style={styles.readoutHint}>TAP TRIANGLES · SWIPE FOR RHYTHM →</Text>
                      </View>
                      <ViewModeIndicator active="harmony" />
                      <HarmonySequence
                        getCycle={getStrudelCycle}
                        isPlaying={transport === 'playing' && harmonyIncluded}
                        labelFor={chordLabel}
                        onClear={handleClearSequence}
                        onRemove={handleRemoveChord}
                        sequence={sequence}
                      />
                    </View>
                  ),
                },
                {
                  id: 'rhythm',
                  content: (
                    <View style={styles.instrumentPage}>
                      <View
                        style={[
                          styles.stage,
                          styles.rhythmStage,
                          { height: instrumentStageHeight },
                        ]}
                      >
                        <RhythmOrbits
                          getPhase={getStrudelPhase}
                          isPlaying={transport === 'playing' && rhythmIncluded}
                          layers={rhythmLayers}
                          onToggleStep={handleToggleStep}
                        />
                      </View>
                      <View style={styles.readout}>
                        <Text style={styles.readoutValue}>{rhythmLabel}</Text>
                        <Text style={styles.readoutHint}>
                          ← SWIPE FOR HARMONY · {BPM} BPM · TOUCH THE ORBITS
                        </Text>
                      </View>
                      <ViewModeIndicator active="rhythm" />
                      <View style={styles.pageFooterSpacer} />
                    </View>
                  ),
                },
              ]}
              selectedIndex={view === 'harmony' ? 0 : 1}
            />
          </SkiaReady>
        </React.Suspense>
      </View>

      <View style={styles.controls}>
        <StackedChips>
          <StackedChips.Trigger onPress={handleTransportToggle}>
            <View style={[styles.chip, masterActive ? styles.stopChip : styles.playChip]}>
              <Text style={[styles.chipText, !masterActive && styles.playChipText]}>
                {masterActive ? '■  STOP' : '▶  PLAY'}
              </Text>
              <Text style={[styles.chipText, !masterActive && styles.playChipText]}>＋</Text>
            </View>
          </StackedChips.Trigger>
          <StackedChips.Content>
            <View style={styles.channelTray}>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleChannelToggle('harmony')}
                style={[styles.channelChip, harmonyIncluded && styles.harmonyChannelActive]}
              >
                <Text style={styles.channelText}>{harmonyIncluded ? 'HARMONY ✓' : 'HARMONY'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleChannelToggle('rhythm')}
                style={[styles.channelChip, rhythmIncluded && styles.rhythmChannelActive]}
              >
                <Text style={styles.channelText}>{rhythmIncluded ? 'RHYTHM ✓' : 'RHYTHM'}</Text>
              </Pressable>
            </View>
          </StackedChips.Content>
        </StackedChips>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: '100%', backgroundColor: '#050609' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
  },
  eyebrow: { color: '#707a8f', fontSize: 10, fontWeight: '700', letterSpacing: 2.2 },
  title: {
    color: '#f7f8ff',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  switchFallback: {
    width: 72,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#171a21',
  },
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
  transportText: { color: '#7f889c', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  carouselArea: { flex: 1, minHeight: 316 },
  instrumentPage: { flex: 1 },
  stage: { flexShrink: 0, minHeight: 220, overflow: 'hidden' },
  harmonyStage: { backgroundColor: '#070911' },
  rhythmStage: { backgroundColor: '#060b0d' },
  hexagonArea: { flex: 1, minHeight: 150 },
  readout: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 6 },
  readoutValue: {
    color: '#f7f8ff',
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  readoutHint: {
    color: '#697184',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.7,
    marginTop: 4,
    textAlign: 'center',
  },
  pageFooterSpacer: { height: 48 },
  controls: { alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 7, paddingBottom: 14 },
  chip: {
    minWidth: 116,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderRadius: 999,
    paddingHorizontal: 17,
  },
  playChip: { backgroundColor: '#f7f8ff' },
  stopChip: { backgroundColor: '#3b2030' },
  playChipText: { color: '#08090c' },
  chipText: { color: '#f7f8ff', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  channelTray: { flexDirection: 'row', gap: 6, marginLeft: 10 },
  channelChip: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#20242d',
    borderWidth: 1,
    borderColor: '#303541',
  },
  harmonyChannelActive: { backgroundColor: '#4a3320', borderColor: '#f3b15a' },
  rhythmChannelActive: { backgroundColor: '#153a38', borderColor: '#56cfc4' },
  channelText: { color: '#f7f8ff', fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
});
