// SPDX-License-Identifier: AGPL-3.0-only
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FlexiPreviewButton } from '@/components/flexi-preview-button';
import { CaptureTempoSlider } from '@/components/capture-tempo-slider';
import { RollingCounter } from '@/components/rolling-counter';
import { SensitivitySlider } from '@/components/sensitivity-slider';
import {
  captureRhythm,
  type CapturedRhythmBuffer,
  type RhythmCapturePhase,
  type RhythmCaptureProgress,
} from '@/packages/audio/src/rhythm-capture';
import { loadSensitivity, saveSensitivity } from '@/packages/audio/src/sensitivity-store';
import { analyzeRhythmBufferDetailed } from '@/packages/music-core/src/rhythm-detection';
import {
  setCaptureTempo,
  setCapturedStep,
  type CaptureLane,
  type RhythmCaptureAnalysis,
} from '@/packages/music-core/src/rhythm-capture';

interface RhythmCaptureDialogProps {
  onApply: (analysis: RhythmCaptureAnalysis, applyTempo: boolean) => void;
  onClose: () => void;
  onPausePreview: () => void;
  onPreview: (analysis: RhythmCaptureAnalysis) => void;
  onStopPreview: () => void;
  visible: boolean;
}

type DialogState = 'intro' | RhythmCapturePhase | 'result' | 'confirm' | 'error';

const LANE_META = [
  { id: 'pulse' as const, label: 'PULSE', color: '#F3B15A' },
  { id: 'click' as const, label: 'CLICK', color: '#56CFC4' },
  { id: 'air' as const, label: 'AIR', color: '#E87BAC' },
] as const;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'NotAllowedError') {
    return 'Microphone access was not granted. Allow it in your browser settings and try again.';
  }
  if (error instanceof Error && error.message === 'MICROPHONE_UNAVAILABLE') {
    return 'This browser does not expose microphone capture on this page. Open Orbifold Play through the secure HTTPS test link, then try again.';
  }
  if (error instanceof Error && error.message === 'HTTPS_REQUIRED') {
    return 'Microphone capture requires HTTPS on a phone. Open the secure test link instead of the local network address.';
  }
  if (error instanceof Error && error.message === 'TOO_FEW_HITS') {
    return 'We heard too few clear hits. Repeat the same groove 3–4 times and keep the phone nearby.';
  }
  return error instanceof Error ? error.message : 'The capture could not be completed.';
}

export function RhythmCaptureDialog({
  onApply,
  onClose,
  onPausePreview,
  onPreview,
  onStopPreview,
  visible,
}: RhythmCaptureDialogProps) {
  const [state, setState] = useState<DialogState>('intro');
  const [progress, setProgress] = useState<RhythmCaptureProgress | null>(null);
  const [level, setLevel] = useState(0);
  const [threshold, setThreshold] = useState(0.015);
  const [lastLane, setLastLane] = useState<CaptureLane | null>(null);
  const [analysis, setAnalysis] = useState<RhythmCaptureAnalysis | null>(null);
  const [applyTempo, setApplyTempo] = useState(true);
  const [error, setError] = useState('');
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [capturedBuffer, setCapturedBuffer] = useState<CapturedRhythmBuffer | null>(null);
  const [detectedCount, setDetectedCount] = useState(0);
  // True when re-detection at the current sensitivity found too few hits to
  // form a pattern; the shown pattern is then stale, so apply/preview are held.
  const [reanalysisTooFew, setReanalysisTooFew] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Keep the live sensitivity readable inside capture callbacks.
  const sensitivityRef = useRef(0.5);
  // Gesture responders can outlive a render. Keep audition state in a ref so
  // moving the BPM slider always retimes an already-playing preview.
  const previewPlayingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      // Preload the remembered per-voice sensitivity when the dialog opens.
      const stored = loadSensitivity();
      sensitivityRef.current = stored;
      setSensitivity(stored);
      return;
    }
    abortRef.current?.abort();
    onStopPreview();
    previewPlayingRef.current = false;
    setPreviewPlaying(false);
    setState('intro');
    setAnalysis(null);
    setProgress(null);
    setLastLane(null);
    setCapturedBuffer(null);
  }, [onStopPreview, visible]);

  if (!visible) return null;

  const start = async (): Promise<void> => {
    const controller = new AbortController();
    abortRef.current = controller;
    setError('');
    setAnalysis(null);
    previewPlayingRef.current = false;
    setPreviewPlaying(false);
    try {
      const result = await captureRhythm({
        captureSeconds: 10,
        sensitivity: sensitivityRef.current,
        signal: controller.signal,
        onCaptured: (buffer, onsetCount) => {
          setCapturedBuffer(buffer);
          setDetectedCount(onsetCount);
          setReanalysisTooFew(false);
        },
        onHit: (lane) => {
          setLastLane(lane);
          setTimeout(() => setLastLane((current) => (current === lane ? null : current)), 130);
        },
        onLevel: (nextLevel, nextThreshold) => {
          setLevel(nextLevel);
          setThreshold(nextThreshold);
        },
        onProgress: (nextProgress) => {
          setProgress(nextProgress);
          setState(nextProgress.phase);
        },
      });
      setAnalysis(result);
      setDetectedBpm(result.bpm);
      setApplyTempo(true);
      setState('result');
    } catch (captureError) {
      if (captureError instanceof DOMException && captureError.name === 'AbortError') return;
      setError(errorMessage(captureError));
      setState('error');
    }
  };

  // Re-detect the already-recorded buffer at a new sensitivity (ADR 0035): no
  // re-recording, a single offline pass on the same PCM yields both the count
  // and the pattern.
  const changeSensitivity = (next: number): void => {
    sensitivityRef.current = next;
    setSensitivity(next);
    if (!capturedBuffer) return;
    const { analysis: reanalyzed, onsetCount } = analyzeRhythmBufferDetailed(
      capturedBuffer.samples,
      capturedBuffer.sampleRate,
      capturedBuffer.captureSeconds,
      { ambientFloor: capturedBuffer.ambientFloor, sensitivity: next },
    );
    setDetectedCount(onsetCount);
    if (reanalyzed) {
      setReanalysisTooFew(false);
      setAnalysis(reanalyzed);
      setDetectedBpm(reanalyzed.bpm);
      if (previewPlayingRef.current) onPreview(reanalyzed);
    } else {
      // Too few hits at this sensitivity: the last pattern is now stale, so
      // stop the preview and hold apply until the count recovers.
      setReanalysisTooFew(true);
      if (previewPlayingRef.current) {
        onPausePreview();
        previewPlayingRef.current = false;
        setPreviewPlaying(false);
      }
    }
  };

  const close = (): void => {
    abortRef.current?.abort();
    // Remember the tuned sensitivity even when closing without confirming, so
    // calibration- or review-time tuning survives across sessions.
    saveSensitivity(sensitivityRef.current);
    onStopPreview();
    previewPlayingRef.current = false;
    setPreviewPlaying(false);
    onClose();
  };

  const setPreviewTempo = (targetBpm: number): void => {
    setAnalysis((current) => {
      if (!current) return current;
      const next = setCaptureTempo(current, targetBpm);
      if (previewPlayingRef.current) onPreview(next);
      return next;
    });
  };

  const togglePreview = (): void => {
    if (!analysis) return;
    if (previewPlaying) {
      onPausePreview();
      previewPlayingRef.current = false;
      setPreviewPlaying(false);
      return;
    }
    onPreview(analysis);
    previewPlayingRef.current = true;
    setPreviewPlaying(true);
  };

  const toggleCapturedStep = (lane: CaptureLane, step: number): void => {
    setAnalysis((current) => {
      if (!current) return current;
      const next = setCapturedStep(current, lane, step, current.appliedPattern[lane][step] !== 1);
      if (previewPlayingRef.current) onPreview(next);
      return next;
    });
  };

  const activeCapture =
    state === 'permission' ||
    state === 'calibrating' ||
    state === 'countdown' ||
    state === 'recording' ||
    state === 'analyzing';
  const meterWidth = `${Math.min(100, (level / Math.max(0.001, threshold * 2)) * 100)}%` as const;
  const tempoRange = (() => {
    const base = detectedBpm ?? analysis?.bpm ?? 120;
    return {
      minimum: Math.max(40, Math.floor((base / 2) / 5) * 5),
      maximum: Math.min(280, Math.ceil((base * 2) / 5) * 5),
    };
  })();

  return (
    <View accessibilityViewIsModal style={styles.root}>
      <BlurView intensity={36} pointerEvents="none" style={StyleSheet.absoluteFill} tint="dark" />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint]} />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>RHYTHM CAPTURE</Text>
          <Text style={styles.title}>
            {state === 'result' || state === 'confirm'
              ? 'Your groove'
              : state === 'recording'
                ? 'Keep repeating it'
                : 'Beatbox your rhythm'}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Close rhythm capture"
          accessibilityRole="button"
          disabled={activeCapture}
          hitSlop={10}
          onPress={close}
          style={[styles.closeButton, activeCapture && styles.disabled]}
        >
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>

      {state === 'intro' || state === 'error' ? (
        <View style={styles.body}>
          <View style={styles.guide}>
            <Text style={styles.guideNumber}>01</Text>
            <Text style={styles.guideText}>Stay quiet for a 2-second room calibration.</Text>
          </View>
          <View style={styles.guide}>
            <Text style={styles.guideNumber}>02</Text>
            <Text style={styles.guideText}>
              After the neutral countdown, repeat one groove 3–4 times mixing “bum” (kick),
              “pa” (snare) and “tss” (hat).
            </Text>
          </View>
          <View style={styles.guide}>
            <Text style={styles.guideNumber}>03</Text>
            <Text style={styles.guideText}>Listen, correct the tempo if needed, then confirm.</Text>
          </View>
          {state === 'error' ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => void start()} style={styles.primary}>
            <Text style={styles.primaryText}>
              {state === 'error' ? 'TRY AGAIN' : 'USE MICROPHONE'}
            </Text>
          </Pressable>
          <Text style={styles.privacy}>Audio is analyzed on this device and is not uploaded.</Text>
        </View>
      ) : null}

      {activeCapture ? (
        <View style={[styles.body, styles.captureBody]}>
          {state === 'countdown' ? (
            <View style={styles.countdownBlock}>
              <Text style={styles.countdownLabel}>GET READY</Text>
              <RollingCounter fontSize={64} value={Math.ceil(progress?.secondsLeft ?? 3)} />
            </View>
          ) : (
            <Text style={styles.phaseLabel}>
              {state === 'permission'
                ? 'WAITING FOR MICROPHONE'
                : state === 'calibrating'
                  ? 'STAY QUIET · CALIBRATING'
                  : state === 'analyzing'
                    ? 'ANALYZING · BUILDING PATTERN'
                    : `RECORDING · ${Math.ceil(progress?.secondsLeft ?? 10)}S`}
            </Text>
          )}
          <View style={styles.meter}>
            <View style={[styles.meterFill, { width: meterWidth }]} />
            <View style={styles.threshold} />
          </View>
          <View style={styles.laneLights}>
            {LANE_META.map((lane) => (
              <View
                key={lane.id}
                style={[
                  styles.laneLight,
                  { borderColor: lane.color },
                  lastLane === lane.id && { backgroundColor: lane.color },
                ]}
              >
                <Text style={styles.laneLightText}>{lane.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.captureHint}>
            {state === 'recording'
              ? 'Say “bum” for kick, “pa” for snare, “tss” for hat. The lights show how each hit is classified.'
              : 'The countdown does not impose a tempo. You define the pulse.'}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round((progress?.progress ?? 0) * 100)}%` },
              ]}
            />
          </View>
        </View>
      ) : null}

      {(state === 'result' || state === 'confirm') && analysis ? (
        <View style={[styles.body, styles.resultBody]}>
          <View style={styles.resultMeta}>
            <View>
              <Text style={styles.resultValue}>{Math.round(analysis.bpm)}</Text>
              <Text style={styles.resultLabel}>BPM NOW</Text>
            </View>
            <View>
              <Text style={styles.resultValue}>{Math.round(analysis.confidence * 100)}%</Text>
              <Text style={styles.resultLabel}>CONFIDENCE</Text>
            </View>
            <View>
              <Text style={styles.resultValue}>{analysis.bars}</Text>
              <Text style={styles.resultLabel}>{analysis.bars === 1 ? 'BAR' : 'BARS'}</Text>
            </View>
          </View>
          <View style={styles.pattern}>
            {LANE_META.map((lane) => (
              <View key={lane.id} style={styles.patternRow}>
                <Text style={[styles.patternLabel, { color: lane.color }]}>{lane.label}</Text>
                <View
                  accessibilityLabel={`${lane.label} captured rhythm steps`}
                  style={styles.steps}
                >
                  {Array.from({ length: 4 }, (_, beat) => (
                    <View key={beat} style={styles.beatGroup}>
                      {analysis.appliedPattern[lane.id]
                        .slice(beat * 4, beat * 4 + 4)
                        .map((active, offset) => {
                          const index = beat * 4 + offset;
                          return (
                            <Pressable
                              accessibilityLabel={`${lane.label} step ${index + 1}`}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: active === 1 }}
                              disabled={state === 'confirm'}
                              key={index}
                              onPress={() => toggleCapturedStep(lane.id, index)}
                              style={[
                                styles.step,
                                active === 1 && {
                                  backgroundColor: lane.color,
                                  borderColor: lane.color,
                                },
                              ]}
                            />
                          );
                        })}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
          {capturedBuffer && state === 'result' ? (
            <SensitivitySlider
              detectedCount={detectedCount}
              onValueChange={changeSensitivity}
              value={sensitivity}
            />
          ) : null}
          <View style={styles.tempoSection}>
            <CaptureTempoSlider
              detectedBpm={detectedBpm ?? analysis.bpm}
              maximum={tempoRange.maximum}
              minimum={tempoRange.minimum}
              onValueChange={setPreviewTempo}
              value={analysis.bpm}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: applyTempo }}
              onPress={() => setApplyTempo((current) => !current)}
              style={styles.applyTempoToggle}
            >
              <Text style={styles.applyTempoText}>
                {applyTempo ? '✓ ' : ''}USE THIS BPM IN ORBIFOLD
              </Text>
            </Pressable>
          </View>
          {analysis.bars === 2 ? (
            <Text style={styles.twoBarNote}>
              Full 32-step capture preserved · both bars are folded into the 16-step orbit view.
            </Text>
          ) : null}
          <View style={styles.resultActions}>
            {state === 'confirm' ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>Replace all three current rhythm orbits?</Text>
                <View style={styles.confirmRow}>
                  <Pressable onPress={() => setState('result')} style={styles.secondaryWide}>
                    <Text style={styles.secondaryText}>CANCEL</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      // Remember the tuned sensitivity as the per-voice
                      // reference for next time (device-local scalar, ADR 0035).
                      saveSensitivity(sensitivityRef.current);
                      onStopPreview();
                      onApply(analysis, applyTempo);
                      onClose();
                    }}
                    style={styles.primaryWide}
                  >
                    <Text style={styles.primaryText}>CONFIRM REPLACE</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.transportDock}>
                  <Pressable
                    accessibilityLabel="Record this rhythm again"
                    accessibilityRole="button"
                      onPress={() => {
                        onStopPreview();
                        previewPlayingRef.current = false;
                        setPreviewPlaying(false);
                        setState('intro');
                      }}
                    style={styles.recordAgain}
                  >
                    <Text style={styles.secondaryText}>↻ RECORD AGAIN</Text>
                  </Pressable>
                  <FlexiPreviewButton isPlaying={previewPlaying} onPress={togglePreview} />
                  <Pressable
                    accessibilityLabel="Use captured rhythm"
                    accessibilityRole="button"
                    disabled={reanalysisTooFew}
                    onPress={() => setState('confirm')}
                    style={[styles.useCompact, reanalysisTooFew && styles.disabled]}
                  >
                    <Text style={styles.useCompactText}>✓ USE</Text>
                  </Pressable>
                </View>
                {reanalysisTooFew ? (
                  <Text style={styles.tooFewNote}>
                    Too few hits at this sensitivity — raise it until the pattern returns.
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    inset: 0,
    zIndex: 100,
    overflow: 'hidden',
    backgroundColor: '#050609',
  },
  tint: { backgroundColor: 'rgba(5, 8, 13, 0.56)' },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  eyebrow: { color: '#71808D', fontSize: 7, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#F7F8FF', fontSize: 17, fontWeight: '600', marginTop: 3 },
  closeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#394252',
  },
  closeGlyph: { color: '#D9DEEA', fontSize: 18 },
  disabled: { opacity: 0.25 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 16, justifyContent: 'center' },
  resultBody: { justifyContent: 'flex-start', paddingTop: 10 },
  guide: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  guideNumber: { color: '#8AA0FF', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  guideText: { flex: 1, color: '#B3BDCD', fontSize: 10, lineHeight: 14 },
  primary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 11,
    marginTop: 9,
    borderRadius: 999,
    backgroundColor: '#F7F8FF',
  },
  primaryText: { color: '#08090C', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  countdownBlock: { alignItems: 'center', gap: 6 },
  countdownLabel: { color: '#71809A', fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  privacy: { color: '#586476', textAlign: 'center', fontSize: 7, marginTop: 7 },
  error: { color: '#E87BAC', fontSize: 9, lineHeight: 13, marginTop: 5 },
  captureBody: { alignItems: 'center' },
  phaseLabel: { color: '#F7F8FF', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  meter: {
    width: '92%',
    height: 12,
    overflow: 'hidden',
    marginTop: 18,
    borderRadius: 8,
    backgroundColor: '#151B24',
  },
  meterFill: { height: '100%', backgroundColor: '#8AA0FF' },
  threshold: {
    position: 'absolute',
    left: '50%',
    height: '100%',
    borderLeftWidth: 1,
    borderColor: '#E87BAC',
  },
  laneLights: { flexDirection: 'row', gap: 10, marginTop: 18 },
  laneLight: {
    width: 62,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
  laneLightText: { color: '#F7F8FF', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  captureHint: {
    maxWidth: 280,
    color: '#738093',
    textAlign: 'center',
    fontSize: 8,
    lineHeight: 12,
    marginTop: 15,
  },
  progressTrack: { width: '92%', height: 2, backgroundColor: '#222936', marginTop: 15 },
  progressFill: { height: 2, backgroundColor: '#56CFC4' },
  resultMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(17, 23, 32, 0.72)',
  },
  resultValue: { color: '#F7F8FF', fontSize: 19, fontWeight: '600', textAlign: 'center' },
  resultLabel: { color: '#687587', fontSize: 6, fontWeight: '800', letterSpacing: 0.7 },
  pattern: { gap: 4 },
  patternRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  patternLabel: { width: 35, fontSize: 6, fontWeight: '900' },
  steps: { flex: 1, flexDirection: 'row', gap: 4 },
  beatGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 1,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: 'rgba(48, 57, 72, 0.28)',
  },
  step: {
    flex: 1,
    minWidth: 0,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#303948',
    backgroundColor: '#111720',
  },
  tempoSection: { marginTop: 5 },
  secondaryText: { color: '#DCE2ED', fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  applyTempoToggle: {
    alignItems: 'center',
    paddingVertical: 7,
    marginTop: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(138, 160, 255, 0.36)',
    backgroundColor: 'rgba(138,160,255,0.10)',
  },
  applyTempoText: { color: '#DCE2ED', fontSize: 7, fontWeight: '800', letterSpacing: 0.6 },
  twoBarNote: { color: '#687587', fontSize: 6.5, textAlign: 'center', marginTop: 6 },
  tooFewNote: { color: '#E87BAC', fontSize: 6.5, textAlign: 'center', marginTop: 8 },
  resultActions: { marginTop: 22 },
  transportDock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 },
  recordAgain: {
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#394252',
  },
  secondaryWide: {
    flex: 0.42,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#394252',
  },
  primaryWide: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F7F8FF',
  },
  useCompact: {
    minWidth: 50,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(138,160,255,0.72)',
    backgroundColor: 'rgba(138,160,255,0.14)',
  },
  useCompactText: { color: '#DCE2ED', fontSize: 6.5, fontWeight: '900', letterSpacing: 0.55 },
  confirmBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(232,123,172,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232,123,172,0.35)',
  },
  confirmText: { color: '#F7F8FF', fontSize: 9, textAlign: 'center' },
});
