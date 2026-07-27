// SPDX-License-Identifier: AGPL-3.0-only
// A dependency-free, touch-first BPM slider. Its marked tempo anchors make
// deliberate musical values easy to find without hiding the exact BPM.
import React, { useMemo, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  View,
} from 'react-native';

interface CaptureTempoSliderProps {
  detectedBpm: number;
  maximum: number;
  minimum: number;
  onValueChange: (bpm: number) => void;
  value: number;
}

const MUSICAL_ANCHORS = [60, 70, 80, 90, 100, 110, 120, 128, 130, 140, 150, 160, 180, 200];

function constrain(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function CaptureTempoSlider({
  detectedBpm,
  maximum,
  minimum,
  onValueChange,
  value,
}: CaptureTempoSliderProps) {
  const [width, setWidth] = useState(0);
  const range = maximum - minimum;
  const currentPosition = `${((constrain(value, minimum, maximum) - minimum) / range) * 100}%` as unknown as number;
  const detectedPosition = `${((constrain(detectedBpm, minimum, maximum) - minimum) / range) * 100}%` as unknown as number;
  const anchors = useMemo(
    () => MUSICAL_ANCHORS.filter((anchor) => anchor > minimum && anchor < maximum),
    [maximum, minimum],
  );

  const updateFromPosition = (x: number): void => {
    if (width <= 0) return;
    const raw = minimum + (constrain(x, 0, width) / width) * range;
    const nearestAnchor = anchors.reduce(
      (nearest, anchor) => (Math.abs(raw - anchor) < Math.abs(raw - nearest) ? anchor : nearest),
      detectedBpm,
    );
    // Always settle on an integer BPM; inside a small attraction zone, settle
    // on familiar musical tempos or the detected reading.
    const snapped = Math.abs(raw - nearestAnchor) <= 2.5 ? nearestAnchor : Math.round(raw);
    onValueChange(constrain(snapped, minimum, maximum));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => updateFromPosition(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updateFromPosition(event.nativeEvent.locationX),
      }),
    [width, minimum, maximum, detectedBpm, anchors, onValueChange],
  );

  const onLayout = (event: LayoutChangeEvent): void => setWidth(event.nativeEvent.layout.width);
  const adjust = (amount: number): void => onValueChange(constrain(value + amount, minimum, maximum));

  return (
    <View style={styles.section}>
      <View style={styles.valueRow}>
        <Text style={styles.now}>NOW · {Math.round(value)} BPM</Text>
        <Text style={styles.snapHint}>SNAPS TO BEAT TEMPOS</Text>
      </View>
      <View
        {...panResponder.panHandlers}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityLabel="Captured rhythm BPM"
        accessibilityRole="adjustable"
        accessibilityValue={{ max: maximum, min: minimum, now: Math.round(value), text: `${Math.round(value)} BPM` }}
        onAccessibilityAction={(event) => adjust(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
        onLayout={onLayout}
        style={styles.hitArea}
      >
        <View style={styles.track} />
        <View style={[styles.activeTrack, { width: currentPosition }]} />
        {anchors.map((anchor) => (
          <View
            key={anchor}
            pointerEvents="none"
            style={[styles.anchor, { left: `${((anchor - minimum) / range) * 100}%` as unknown as number }]}
          />
        ))}
        <View pointerEvents="none" style={[styles.detectedMarker, { left: detectedPosition }]}>
          <View style={styles.detectedLine} />
          <Text style={styles.detectedText}>DETECTED {Math.round(detectedBpm)}</Text>
        </View>
        <View pointerEvents="none" style={[styles.handle, { left: currentPosition }]}>
          <View style={styles.handleCore} />
        </View>
      </View>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>{Math.round(minimum)}</Text>
        <Text style={styles.rangeLabel}>{Math.round(maximum)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 15 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 },
  now: { color: '#F7F8FF', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  snapHint: { color: '#71809A', fontSize: 5.5, fontWeight: '800', letterSpacing: 0.5 },
  hitArea: { height: 45, justifyContent: 'center' },
  track: { height: 2, borderRadius: 2, backgroundColor: '#414C60' },
  activeTrack: { position: 'absolute', left: 0, height: 2, borderRadius: 2, backgroundColor: '#8AA0FF' },
  anchor: {
    position: 'absolute',
    width: 2,
    height: 8,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: '#69778D',
  },
  detectedMarker: { position: 'absolute', bottom: 1, width: 1, alignItems: 'center' },
  detectedLine: { width: 1, height: 10, backgroundColor: '#56CFC4' },
  detectedText: {
    position: 'absolute',
    top: 12,
    width: 86,
    color: '#56CFC4',
    fontSize: 5.5,
    fontWeight: '900',
    letterSpacing: 0.45,
    textAlign: 'center',
  },
  handle: {
    position: 'absolute',
    width: 24,
    height: 24,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E9EDFF',
    shadowColor: '#8AA0FF',
    shadowOpacity: 0.38,
    shadowRadius: 7,
  },
  handleCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8AA0FF' },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -1 },
  rangeLabel: { color: '#667488', fontSize: 6, fontWeight: '800', letterSpacing: 0.4 },
});
