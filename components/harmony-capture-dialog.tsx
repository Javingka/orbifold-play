// SPDX-License-Identifier: AGPL-3.0-only
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CaptureTempoSlider } from '@/components/capture-tempo-slider';
import { FlexiPreviewButton } from '@/components/flexi-preview-button';
import { HarmonyCaptureRoll } from '@/components/harmony-capture-roll';
import { HarmonyCaptureSheet } from '@/components/harmony-capture-sheet';
import {
  captureHarmony,
  type HarmonyCapturePhase,
  type HarmonyCaptureProgress,
} from '@/packages/audio/src/harmony-capture';
import { getStrudelCycle } from '@/packages/audio/src/strudel-engine';
import {
  removeHarmonyCaptureEntry,
  setHarmonyCaptureBpm,
  updateHarmonyCaptureEntry,
  type HarmonyCaptureAnalysis,
} from '@/packages/music-core/src/harmony-capture';

interface Props {
  onApply: (analysis: HarmonyCaptureAnalysis, applyTempo: boolean) => void;
  onClose: () => void;
  onPausePreview: () => void;
  onPreview: (analysis: HarmonyCaptureAnalysis) => void;
  onStopPreview: () => void;
  visible: boolean;
}

type State = 'intro' | HarmonyCapturePhase | 'result' | 'confirm' | 'error';
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

function message(error: unknown): string {
  if (error instanceof Error && error.name === 'NotAllowedError') return 'Microphone permission was not granted. Allow it in browser settings and try again.';
  if (error instanceof Error && error.message === 'HTTPS_REQUIRED') return 'Microphone capture requires HTTPS on a phone. Open the secure test link.';
  if (error instanceof Error && error.message === 'MICROPHONE_UNAVAILABLE') return 'This page cannot access a microphone. Open Orbifold Play through the secure HTTPS link.';
  if (error instanceof Error && error.message === 'TOO_FEW_NOTES') return 'We heard too few stable roots. Hold each note clearly and repeat the same sequence 3–4 times.';
  if (error instanceof Error && error.message === 'ANALYSIS_FAILED') return 'We heard notes but could not form a repeated progression. Keep the same root order for 3–4 repetitions and try again.';
  return error instanceof Error ? error.message : 'Harmony capture could not be completed.';
}

export function HarmonyCaptureDialog({
  onApply,
  onClose,
  onPausePreview,
  onPreview,
  onStopPreview,
  visible,
}: Props) {
  const [state, setState] = useState<State>('intro');
  const [analysis, setAnalysis] = useState<HarmonyCaptureAnalysis | null>(null);
  const [detectedBpm, setDetectedBpm] = useState(120);
  const [progress, setProgress] = useState<HarmonyCaptureProgress | null>(null);
  const [level, setLevel] = useState(0);
  const [pitch, setPitch] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<number | null>(null);
  const previewRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (visible) return;
    abortRef.current?.abort();
    onStopPreview();
    previewRef.current = false;
    setPreview(false);
    setState('intro');
    setAnalysis(null);
  }, [onStopPreview, visible]);

  if (!visible) return null;
  const active = ['permission', 'calibrating', 'countdown', 'recording', 'analyzing'].includes(state);
  const selected =
    analysis && selectedEntry !== null ? analysis.entries[selectedEntry] : undefined;

  const stopPreview = (): void => {
    onStopPreview();
    previewRef.current = false;
    setPreview(false);
  };
  const close = (): void => {
    abortRef.current?.abort();
    stopPreview();
    onClose();
  };
  const start = async (): Promise<void> => {
    const controller = new AbortController();
    abortRef.current = controller;
    stopPreview();
    setError('');
    try {
      const result = await captureHarmony({
        signal: controller.signal,
        onLevel: setLevel,
        onPitch: (midi) => setPitch(midi),
        onProgress: (next) => {
          setProgress(next);
          setState(next.phase);
        },
      });
      setAnalysis(result);
      setSelectedEntry(null);
      setDetectedBpm(result.bpm);
      setState('result');
    } catch (captureError) {
      if (captureError instanceof DOMException && captureError.name === 'AbortError') return;
      setError(message(captureError));
      setState('error');
    }
  };
  const update = (next: HarmonyCaptureAnalysis): void => {
    setAnalysis(next);
    if (previewRef.current) onPreview(next);
  };
  const togglePreview = (): void => {
    if (!analysis) return;
    if (preview) {
      onPausePreview();
      previewRef.current = false;
      setPreview(false);
    } else {
      onPreview(analysis);
      previewRef.current = true;
      setPreview(true);
    }
  };

  return (
    <View accessibilityViewIsModal style={styles.root}>
      <BlurView intensity={36} pointerEvents="none" style={StyleSheet.absoluteFill} tint="dark" />
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>HARMONY CAPTURE</Text><Text style={styles.title}>{state === 'result' || state === 'confirm' ? 'Your captured melody' : 'Sing the roots'}</Text></View>
        <Pressable accessibilityLabel="Close harmony capture" accessibilityRole="button" accessibilityState={{ disabled: active }} disabled={active} hitSlop={10} onPress={close} style={[styles.close, active && styles.disabled]}><Text style={styles.closeText}>×</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {state === 'intro' || state === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.lead}>Sing, whistle, or play one root note for each chord. Repeat the same sequence 3–4 times.</Text>
            <Text style={styles.note}>Orbifold detects single roots. Major/minor qualities are editable tonal suggestions—not detected chords.</Text>
            <View style={styles.guide}><Text style={styles.guideNo}>01</Text><Text style={styles.guideText}>Stay quiet during the 2-second room calibration.</Text></View>
            <View style={styles.guide}><Text style={styles.guideNo}>02</Text><Text style={styles.guideText}>After the neutral countdown, hold each root clearly.</Text></View>
            <View style={styles.guide}><Text style={styles.guideNo}>03</Text><Text style={styles.guideText}>Review roots, qualities and lengths before replacing anything.</Text></View>
            {state === 'error' ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" onPress={() => void start()} style={styles.primary}><Text style={styles.primaryText}>{state === 'error' ? 'TRY AGAIN' : 'USE MICROPHONE'}</Text></Pressable>
            <Text style={styles.privacy}>Audio is analyzed on this device and is not uploaded.</Text>
          </View>
        ) : null}
        {active ? (
          <View style={styles.center}>
            <Text style={styles.phase}>{state === 'permission' ? 'WAITING FOR MICROPHONE' : state === 'calibrating' ? 'STAY QUIET · CALIBRATING' : state === 'countdown' ? `GET READY · ${progress?.secondsLeft.toFixed(0) ?? 3}` : state === 'recording' ? `RECORDING · ${Math.ceil(progress?.secondsLeft ?? 12)}S` : 'ANALYZING ROOTS'}</Text>
            <Text style={styles.livePitch}>{pitch === null ? '—' : `${NAMES[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`}</Text>
            <View style={styles.meter}><View style={[styles.meterFill, { width: `${Math.min(100, level * 1800)}%` }]} /></View>
            <Text style={styles.note}>Keep the same root order each time. The countdown does not impose your tempo.</Text>
          </View>
        ) : null}
        {(state === 'result' || state === 'confirm') && analysis ? (
          <View>
            <HarmonyCaptureRoll
              analysis={analysis}
              getCycle={getStrudelCycle}
              isPlaying={preview}
              onSelect={setSelectedEntry}
              selectedIndex={
                selectedEntry === null
                  ? null
                  : Math.min(selectedEntry, Math.max(0, analysis.entries.length - 1))
              }
            />
            <CaptureTempoSlider accessibilityLabel="Captured harmony BPM" detectedBpm={detectedBpm} maximum={Math.min(280, Math.ceil(analysis.bpm * 2 / 5) * 5)} minimum={Math.max(40, Math.floor(analysis.bpm / 2 / 5) * 5)} onValueChange={(bpm) => update(setHarmonyCaptureBpm(analysis, bpm))} value={analysis.bpm} />
            {state === 'confirm' ? (
              <View style={styles.confirm}><Text style={styles.confirmText}>Replace the current harmony progression?</Text><View style={styles.row}><Pressable accessibilityRole="button" onPress={() => setState('result')} style={styles.secondary}><Text style={styles.secondaryText}>CANCEL</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { stopPreview(); onApply(analysis, true); onClose(); }} style={styles.primarySmall}><Text style={styles.primaryText}>CONFIRM REPLACE</Text></Pressable></View></View>
            ) : (
              <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => { stopPreview(); setSelectedEntry(null); setState('intro'); }} style={styles.secondary}><Text style={styles.secondaryText}>↻ AGAIN</Text></Pressable><FlexiPreviewButton isPlaying={preview} onPress={togglePreview} pauseAccessibilityLabel="Pause captured harmony preview" playAccessibilityLabel="Listen to captured harmony" /><Pressable accessibilityRole="button" accessibilityState={{ disabled: analysis.entries.length === 0 }} disabled={analysis.entries.length === 0} onPress={() => { setSelectedEntry(null); setState('confirm'); }} style={[styles.use, analysis.entries.length === 0 && styles.disabled]}><Text style={styles.useText}>✓ USE</Text></Pressable></View>
            )}
          </View>
        ) : null}
      </ScrollView>
      {state === 'result' && analysis && selected && selectedEntry !== null ? (
        <HarmonyCaptureSheet
          entry={selected}
          index={selectedEntry}
          noteLabel={`${NAMES[((selected.midi % 12) + 12) % 12]}${Math.floor(selected.midi / 12) - 1}`}
          onChangeDuration={(duration) =>
            update(updateHarmonyCaptureEntry(analysis, selectedEntry, { duration }))
          }
          onChangeQuality={(quality) =>
            update(updateHarmonyCaptureEntry(analysis, selectedEntry, { quality }))
          }
          onClose={() => setSelectedEntry(null)}
          onLowerRoot={() =>
            update(
              updateHarmonyCaptureEntry(analysis, selectedEntry, {
                midi: selected.midi - 1,
              }),
            )
          }
          onRaiseRoot={() =>
            update(
              updateHarmonyCaptureEntry(analysis, selectedEntry, {
                midi: selected.midi + 1,
              }),
            )
          }
          onRemove={() => {
            update(removeHarmonyCaptureEntry(analysis, selectedEntry));
            setSelectedEntry(null);
          }}
          visible
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', inset: 0, zIndex: 110, backgroundColor: '#050609' },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  eyebrow: { color: '#71808D', fontSize: 7, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#F7F8FF', fontSize: 17, fontWeight: '600', marginTop: 3 },
  close: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#394252', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#D9DEEA', fontSize: 21 }, disabled: { opacity: 0.25 },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingBottom: 20 },
  center: { flex: 1, minHeight: 360, justifyContent: 'center' },
  lead: { color: '#F7F8FF', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  note: { color: '#738093', fontSize: 9, lineHeight: 14, textAlign: 'center', marginVertical: 10 },
  guide: { flexDirection: 'row', gap: 12, alignItems: 'center', marginVertical: 5 },
  guideNo: { color: '#F3B15A', fontSize: 9, fontWeight: '900' }, guideText: { flex: 1, color: '#B3BDCD', fontSize: 10, lineHeight: 14 },
  error: { color: '#E87BAC', fontSize: 9, lineHeight: 14, marginTop: 8 },
  primary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#F7F8FF', marginTop: 12 },
  primaryText: { color: '#08090C', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  privacy: { color: '#586476', textAlign: 'center', fontSize: 7, marginTop: 8 },
  phase: { color: '#F7F8FF', textAlign: 'center', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  livePitch: { color: '#F3B15A', textAlign: 'center', fontSize: 48, fontWeight: '700', marginVertical: 20 },
  meter: { height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: '#151B24' }, meterFill: { height: '100%', backgroundColor: '#56CFC4' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 },
  secondary: { minWidth: 72, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#394252' },
  secondaryText: { color: '#DCE2ED', fontSize: 8, fontWeight: '900' },
  use: { minWidth: 58, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: 'rgba(138,160,255,.18)', borderWidth: 1, borderColor: '#8AA0FF' },
  useText: { color: '#DCE2ED', fontSize: 7, fontWeight: '900' },
  confirm: { padding: 12, marginTop: 14, borderRadius: 14, backgroundColor: 'rgba(232,123,172,.1)', borderWidth: 1, borderColor: 'rgba(232,123,172,.35)' },
  confirmText: { color: '#F7F8FF', textAlign: 'center', fontSize: 10 }, row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  primarySmall: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#F7F8FF' },
});
