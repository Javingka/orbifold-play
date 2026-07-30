// SPDX-License-Identifier: AGPL-3.0-only
// Dependency-free 0..1 detection-sensitivity slider (ADR 0035). Lower rejects
// extra onsets from one sound; higher admits softer/faster hits. The label
// shows how many onsets the current recording yields so the player can tune it
// against what they performed.
import React, { useMemo, useState } from 'react';
import { PanResponder, StyleSheet, Text, type LayoutChangeEvent, View } from 'react-native';

interface SensitivitySliderProps {
  /** Onsets detected in the current recording at this sensitivity. */
  detectedCount: number;
  onValueChange: (sensitivity: number) => void;
  value: number;
}

function constrain(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function SensitivitySlider({ detectedCount, onValueChange, value }: SensitivitySliderProps) {
  const [width, setWidth] = useState(0);
  const position = `${constrain(value, 0, 1) * 100}%` as unknown as number;

  const updateFromPosition = (x: number): void => {
    if (width <= 0) return;
    onValueChange(constrain(x / width, 0, 1));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => updateFromPosition(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updateFromPosition(event.nativeEvent.locationX),
      }),
    [width, onValueChange],
  );

  const onLayout = (event: LayoutChangeEvent): void => setWidth(event.nativeEvent.layout.width);
  const adjust = (amount: number): void => onValueChange(constrain(value + amount, 0, 1));

  return (
    <View style={styles.section}>
      <View style={styles.valueRow}>
        <Text style={styles.label}>SENSITIVITY</Text>
        <Text style={styles.count}>
          {detectedCount} {detectedCount === 1 ? 'HIT' : 'HITS'} DETECTED
        </Text>
      </View>
      <View
        {...panResponder.panHandlers}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityLabel="Detection sensitivity"
        accessibilityRole="adjustable"
        accessibilityValue={{
          max: 100,
          min: 0,
          now: Math.round(value * 100),
          text: `${Math.round(value * 100)} percent, ${detectedCount} hits detected`,
        }}
        onAccessibilityAction={(event) =>
          adjust(event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05)
        }
        onLayout={onLayout}
        style={styles.hitArea}
      >
        <View style={styles.track} />
        <View style={[styles.activeTrack, { width: position }]} />
        <View pointerEvents="none" style={[styles.handle, { left: position }]}>
          <View style={styles.handleCore} />
        </View>
      </View>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>FEWER</Text>
        <Text style={styles.rangeLabel}>MORE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 12 },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  label: { color: '#F7F8FF', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  count: { color: '#8AA0FF', fontSize: 6.5, fontWeight: '900', letterSpacing: 0.5 },
  hitArea: { height: 40, justifyContent: 'center' },
  track: { height: 2, borderRadius: 2, backgroundColor: '#414C60' },
  activeTrack: { position: 'absolute', left: 0, height: 2, borderRadius: 2, backgroundColor: '#8AA0FF' },
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
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 1 },
  rangeLabel: { color: '#667488', fontSize: 6, fontWeight: '800', letterSpacing: 0.4 },
});
