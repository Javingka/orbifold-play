// SPDX-License-Identifier: AGPL-3.0-only
import { StyleSheet, Text, View } from 'react-native';

interface ViewModeIndicatorProps {
  active: 'harmony' | 'rhythm';
}

export function ViewModeIndicator({ active }: ViewModeIndicatorProps) {
  return (
    <View
      accessibilityLabel={`${active === 'harmony' ? 'Harmony' : 'Rhythm'} view selected`}
      style={styles.container}
    >
      <Text style={[styles.label, active === 'harmony' && styles.harmonyText]}>HARMONY</Text>
      <View style={styles.rail}>
        <View
          style={[styles.thumb, active === 'harmony' ? styles.thumbHarmony : styles.thumbRhythm]}
        />
      </View>
      <Text style={[styles.label, active === 'rhythm' && styles.rhythmText]}>RHYTHM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  rail: {
    width: 28,
    height: 4,
    justifyContent: 'center',
    borderRadius: 2,
    backgroundColor: '#252b35',
  },
  thumb: { width: 14, height: 4, borderRadius: 2 },
  thumbHarmony: { alignSelf: 'flex-start', backgroundColor: '#f3b15a' },
  thumbRhythm: { alignSelf: 'flex-end', backgroundColor: '#56cfc4' },
  label: { color: '#4f5768', fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  harmonyText: { color: '#f3b15a' },
  rhythmText: { color: '#56cfc4' },
});
