// SPDX-License-Identifier: AGPL-3.0-only
// Compact duration editor inspired by the Reactix Stepper interaction.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  HARMONY_DURATION_STEPS,
  type HarmonyDuration,
} from '@/packages/music-core/src/harmony-duration';

interface Props {
  compact?: boolean;
  onValueChange: (duration: HarmonyDuration) => void;
  value: HarmonyDuration;
}

export function HarmonyDurationStepper({ compact = false, onValueChange, value }: Props) {
  const index = HARMONY_DURATION_STEPS.indexOf(value);
  const decrement = HARMONY_DURATION_STEPS[Math.max(0, index - 1)];
  const increment = HARMONY_DURATION_STEPS[Math.min(HARMONY_DURATION_STEPS.length - 1, index + 1)];
  const unit = value === 1 ? 'BAR' : 'BARS';

  return (
    <View
      accessibilityLabel={`Chord duration ${value} ${unit.toLowerCase()}`}
      style={[styles.shell, compact && styles.compactShell]}
    >
      <Pressable
        accessibilityLabel="Shorten selected chord"
        accessibilityRole="button"
        accessibilityState={{ disabled: index <= 0 }}
        disabled={index <= 0}
        onPress={() => decrement && onValueChange(decrement)}
        style={[styles.button, compact && styles.compactButton, index <= 0 && styles.disabled]}
      >
        <Text style={styles.symbol}>−</Text>
      </Pressable>
      <View style={[styles.readout, compact && styles.compactReadout]}>
        <Text style={[styles.value, compact && styles.compactValue]}>{value}×</Text>
        {!compact ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      <Pressable
        accessibilityLabel="Lengthen selected chord"
        accessibilityRole="button"
        accessibilityState={{ disabled: index >= HARMONY_DURATION_STEPS.length - 1 }}
        disabled={index >= HARMONY_DURATION_STEPS.length - 1}
        onPress={() => increment && onValueChange(increment)}
        style={[
          styles.button,
          compact && styles.compactButton,
          index >= HARMONY_DURATION_STEPS.length - 1 && styles.disabled,
        ]}
      >
        <Text style={styles.symbol}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#0A0F18',
    borderWidth: 1,
    borderColor: '#354056',
  },
  compactShell: { height: 30, borderRadius: 15 },
  button: { width: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  compactButton: { width: 30 },
  symbol: { color: '#F7F8FF', fontSize: 17, fontWeight: '500' },
  readout: {
    minWidth: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#354056',
    alignSelf: 'stretch',
  },
  compactReadout: { minWidth: 38 },
  value: { color: '#F3B15A', fontSize: 13, fontWeight: '900' },
  compactValue: { fontSize: 9 },
  unit: { color: '#71808D', fontSize: 5.5, fontWeight: '800', letterSpacing: 0.7 },
  disabled: { opacity: 0.28 },
});
