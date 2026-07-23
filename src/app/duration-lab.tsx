// SPDX-License-Identifier: AGPL-3.0-only
import { Link } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChordDurationLab } from '@/components/chord-duration-lab';

export default function DurationLabPage() {
  useEffect(() => {
    if (typeof document !== 'undefined') document.getElementById('orbifold-boot')?.remove();
  }, []);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Link accessibilityLabel="Return to Orbifold" href="/" style={styles.back}>
          ← ORBIFOLD
        </Link>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>EXPLORATION 01</Text>
          <Text style={styles.title}>CHORD DURATION</Text>
        </View>
        <Text style={styles.phase}>LAB</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          TAP A CHORD TO OPEN ITS TIME CONTROL. EACH OPTION KEEPS DELETE AND MUTE EXPLICIT.
        </Text>
        <ChordDurationLab />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#060810' },
  header: {
    minHeight: 66,
    paddingHorizontal: 18,
    borderBottomColor: 'rgba(138,160,255,0.13)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { color: '#8aa0ff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  headerCopy: { alignItems: 'center', gap: 3 },
  eyebrow: { color: '#565e75', fontSize: 7, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#f6f7ff', fontSize: 13, fontWeight: '800', letterSpacing: 1.7 },
  phase: { color: '#56cfc4', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 52 },
  intro: {
    color: '#727a91',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 15,
    letterSpacing: 0.85,
    marginBottom: 14,
    maxWidth: 480,
  },
});
