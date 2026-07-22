// SPDX-License-Identifier: AGPL-3.0-only
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkiaReady } from '@/components/async-skia';
import { MorphLoader } from '@/components/morph-loader';
import { ParallaxCarousel } from '@/components/parallax-carousel';
import { RhythmSoundDialog } from '@/components/rhythm-sound-dialog';
import type { ScaleCarouselOption } from '@/components/scale-blur-carousel';
import { ScaleDialog } from '@/components/scale-dialog';
import { StackedChips } from '@/components/stacked-chips';
import { SwipeHintText } from '@/components/swipe-hint-text';
import { ViewModeIndicator } from '@/components/view-mode-indicator';
import type { RhythmOrbitLayer } from '@/components/rhythm-orbits';
import {
  getStrudelCycle,
  getStrudelPhase,
  playStrudel,
  prepareStrudelAudio,
  previewRhythmSound,
  stopStrudel,
} from '@/packages/audio/src/strudel-engine';
import { bjorklund } from '@/packages/music-core/src/euclidean';
import type { FiniteTonnetzFace } from '@/packages/music-core/src/finite-tonnetz';
import {
  buildPlayablePattern,
  type PlayableRhythmLayer,
} from '@/packages/music-core/src/playable-code';
import { getRhythmSoundOption, type RhythmSoundId } from '@/packages/music-core/src/rhythm-sounds';

const TonnetzArtifact = React.lazy(async () => {
  const module = await import('@/components/tonnetz-artifact');
  return { default: module.TonnetzArtifact };
});
const HarmonySequence = React.lazy(async () => {
  const module = await import('@/components/harmony-sequence');
  return { default: module.HarmonySequence };
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
    role: 'pulse',
    soundId: 'hybrid',
    audioOrbit: 2,
  },
  {
    id: 'click',
    label: 'Click',
    color: '#56cfc4',
    steps: bjorklund(5, 12),
    role: 'click',
    soundId: 'hybrid',
    audioOrbit: 3,
  },
  {
    id: 'air',
    label: 'Air',
    color: '#e87bac',
    steps: bjorklund(3, 8),
    role: 'air',
    soundId: 'hybrid',
    audioOrbit: 4,
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
  const rhythmStageHeight = Math.max(270, Math.min(360, screenHeight * 0.43));
  const harmonyStageHeight = Math.max(284, Math.min(420, screenHeight * 0.5));
  const [view, setView] = useState<InstrumentView>('harmony');
  const [selected, setSelected] = useState<FiniteTonnetzFace | null>(null);
  const [sequence, setSequence] = useState<readonly FiniteTonnetzFace[]>([]);
  const [rhythmLayers, setRhythmLayers] = useState(INITIAL_RHYTHM_LAYERS);
  const [harmonyIncluded, setHarmonyIncluded] = useState(true);
  const [rhythmIncluded, setRhythmIncluded] = useState(true);
  const [selectedScale, setSelectedScale] = useState<ScaleCarouselOption>(
    SCALE_OPTIONS[0] as ScaleCarouselOption,
  );
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [rhythmSoundDialogOpen, setRhythmSoundDialogOpen] = useState(false);
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
                soundId: layer.soundId,
                role: layer.role,
                audioOrbit: layer.audioOrbit,
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
    setScaleDialogOpen(false);
    setRhythmSoundDialogOpen(false);
    void Haptics.selectionAsync();
  }, []);

  const handleScaleSelect = useCallback((option: ScaleCarouselOption): void => {
    setSelectedScale((current) => {
      if (current.id === option.id) return current;
      void Haptics.selectionAsync();
      return option;
    });
  }, []);

  const handleRhythmSoundSelect = (layerId: string, soundId: RhythmSoundId): void => {
    const nextLayers = rhythmLayers.map((layer) => {
      if (layer.id !== layerId || layer.soundId === soundId) return layer;
      return { ...layer, soundId };
    });
    if (nextLayers.every((layer, index) => layer === rhythmLayers[index])) return;
    setRhythmLayers(nextLayers);
    void Haptics.selectionAsync();
    if (playingRef.current && rhythmIncluded) {
      void applyPlayback(currentSnapshot({ layers: nextLayers }));
    }
  };

  const handleRhythmSoundAudition = (layerId: string, soundId: RhythmSoundId): void => {
    const layer = rhythmLayers.find((candidate) => candidate.id === layerId);
    if (!layer) return;
    void previewRhythmSound(soundId, layer.role);
  };

  const selectedLabel = selected ? chordLabel(selected) : 'Build a sequence';
  const rhythmLabel = rhythmLayers
    .map((layer) => `E(${layer.steps.filter(Boolean).length},${layer.steps.length})`)
    .join(' · ');
  const rhythmSoundSummary = rhythmLayers
    .map((layer) => `${layer.label} ${getRhythmSoundOption(layer.soundId).title}`)
    .join(', ');
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
          {view === 'harmony' ? (
            <SwipeHintText onPress={() => handleViewChange('rhythm')} />
          ) : (
            <View style={styles.headerHintSpacer} />
          )}
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
        <Pressable
          accessibilityLabel={
            view === 'harmony'
              ? `Open musical scale menu. Current scale: ${selectedScale.title}`
              : `Open rhythm sound menu. ${rhythmSoundSummary}`
          }
          accessibilityRole="button"
          accessibilityState={{
            expanded: view === 'harmony' ? scaleDialogOpen : rhythmSoundDialogOpen,
          }}
          hitSlop={6}
          onPress={() => {
            if (view === 'harmony') {
              setScaleDialogOpen((current) => !current);
            } else {
              setRhythmSoundDialogOpen((current) => !current);
            }
            void Haptics.selectionAsync();
          }}
          style={[
            styles.contextMenuButton,
            (scaleDialogOpen || rhythmSoundDialogOpen) && styles.contextMenuButtonActive,
          ]}
        >
          {view === 'harmony' ? (
            <View style={styles.scaleMenuIcon}>
              <View style={styles.scaleMenuLine}>
                <View style={[styles.scaleMenuNote, styles.scaleMenuNoteLeft]} />
              </View>
              <View style={styles.scaleMenuLine}>
                <View style={[styles.scaleMenuNote, styles.scaleMenuNoteRight]} />
              </View>
              <View style={styles.scaleMenuLine}>
                <View style={[styles.scaleMenuNote, styles.scaleMenuNoteCenter]} />
              </View>
            </View>
          ) : (
            <View style={styles.orbitMenuIconOuter}>
              <View style={styles.orbitMenuIconMiddle}>
                <View style={styles.orbitMenuIconInner} />
              </View>
            </View>
          )}
        </Pressable>
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
        <React.Suspense fallback={<MorphLoader />}>
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
                        style={[styles.stage, styles.harmonyStage, { height: harmonyStageHeight }]}
                      >
                        <View
                          accessibilityElementsHidden={scaleDialogOpen}
                          aria-hidden={scaleDialogOpen}
                          importantForAccessibility={
                            scaleDialogOpen ? 'no-hide-descendants' : 'auto'
                          }
                          style={styles.hexagonArea}
                        >
                          <TonnetzArtifact
                            selectedId={selected?.id ?? null}
                            scaleMode={selectedScale.mode}
                            scaleRootPc={selectedScale.rootPc}
                            onSelect={handleChordSelect}
                          />
                        </View>
                        <ScaleDialog
                          onClose={() => setScaleDialogOpen(false)}
                          onSelect={handleScaleSelect}
                          options={SCALE_OPTIONS}
                          selectedId={selectedScale.id}
                          visible={scaleDialogOpen}
                        />
                      </View>
                      <View style={styles.readout}>
                        <Text style={styles.readoutValue}>{selectedLabel}</Text>
                        <Text style={styles.readoutHint}>TAP TRIANGLES · BUILD YOUR SEQUENCE</Text>
                      </View>
                      <ViewModeIndicator active="harmony" />
                      <SkiaReady>
                        <HarmonySequence
                          getCycle={getStrudelCycle}
                          isPlaying={transport === 'playing' && harmonyIncluded}
                          labelFor={chordLabel}
                          onClear={handleClearSequence}
                          onRemove={handleRemoveChord}
                          scaleMode={selectedScale.mode}
                          scaleRootPc={selectedScale.rootPc}
                          sequence={sequence}
                        />
                      </SkiaReady>
                    </View>
                  ),
                },
                {
                  id: 'rhythm',
                  content: (
                    <View style={styles.instrumentPage}>
                      <View
                        style={[styles.stage, styles.rhythmStage, { height: rhythmStageHeight }]}
                      >
                        <View
                          accessibilityElementsHidden={rhythmSoundDialogOpen}
                          aria-hidden={rhythmSoundDialogOpen}
                          importantForAccessibility={
                            rhythmSoundDialogOpen ? 'no-hide-descendants' : 'auto'
                          }
                          style={styles.orbitArea}
                        >
                          <RhythmOrbits
                            getPhase={getStrudelPhase}
                            isPlaying={transport === 'playing' && rhythmIncluded}
                            layers={rhythmLayers}
                            onToggleStep={handleToggleStep}
                          />
                        </View>
                        <RhythmSoundDialog
                          layers={rhythmLayers}
                          onAuditionSound={handleRhythmSoundAudition}
                          onClose={() => setRhythmSoundDialogOpen(false)}
                          onSelectSound={handleRhythmSoundSelect}
                          visible={rhythmSoundDialogOpen}
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
  headerHintSpacer: { height: 16 },
  switchFallback: {
    width: 72,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#171a21',
  },
  transportLine: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 7,
  },
  transportDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#697184' },
  transportDotPlaying: { backgroundColor: '#56cfc4' },
  transportDotError: { backgroundColor: '#e87bac' },
  transportText: { color: '#7f889c', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  contextMenuButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(21, 25, 35, 0.72)',
    borderColor: 'rgba(138, 160, 255, 0.22)',
    borderWidth: 1,
  },
  contextMenuButtonActive: {
    backgroundColor: 'rgba(45, 54, 82, 0.84)',
    borderColor: '#8AA0FF',
  },
  scaleMenuIcon: { width: 13, height: 13, justifyContent: 'space-between' },
  scaleMenuLine: {
    width: 13,
    height: 1,
    backgroundColor: '#AAB5CE',
    position: 'relative',
  },
  scaleMenuNote: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F7F8FF',
    position: 'absolute',
    top: -1.5,
  },
  scaleMenuNoteLeft: { left: 1 },
  scaleMenuNoteCenter: { left: 4.5 },
  scaleMenuNoteRight: { right: 1 },
  orbitMenuIconOuter: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#F3B15A',
  },
  orbitMenuIconMiddle: {
    width: 9,
    height: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#56CFC4',
  },
  orbitMenuIconInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E87BAC',
  },
  carouselArea: { flex: 1, minHeight: 316 },
  instrumentPage: { flex: 1 },
  stage: { flexShrink: 0, minHeight: 220, overflow: 'hidden' },
  harmonyStage: { backgroundColor: '#070911' },
  rhythmStage: { backgroundColor: '#060b0d' },
  hexagonArea: { flex: 1, minHeight: 150 },
  orbitArea: { flex: 1, minHeight: 220 },
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
