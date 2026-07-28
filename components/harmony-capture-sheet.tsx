// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HarmonyDurationStepper } from '@/components/harmony-duration-stepper';
import { ReacticxBottomSheet } from '@/components/reacticx-bottom-sheet';
import type { HarmonyCaptureEntry } from '@/packages/music-core/src/harmony-capture';
import type { HarmonyDuration } from '@/packages/music-core/src/harmony-duration';

interface Props {
  entry: HarmonyCaptureEntry;
  index: number;
  noteLabel: string;
  onChangeDuration: (duration: HarmonyDuration) => void;
  onChangeQuality: (quality: 'maj' | 'min') => void;
  onClose: () => void;
  onLowerRoot: () => void;
  onRaiseRoot: () => void;
  onRemove: () => void;
  visible: boolean;
}

export function HarmonyCaptureSheet({
  entry,
  index,
  noteLabel,
  onChangeDuration,
  onChangeQuality,
  onClose,
  onLowerRoot,
  onRaiseRoot,
  onRemove,
  visible,
}: Props) {
  const insets = useSafeAreaInsets();
  const sheetHeight = 222 + Math.max(insets.bottom, 8);

  return (
    <ReacticxBottomSheet
      enableBackdrop={false}
      height={sheetHeight}
      onClose={onClose}
      visible={visible}
    >
      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>EDIT CHORD {String(index + 1).padStart(2, '0')}</Text>
            <Text style={styles.chord}>
              {noteLabel} {entry.face.quality === 'min' ? 'minor' : 'major'}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Close chord editor"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.close}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <View style={styles.rootRow}>
          <Text style={styles.label}>ROOT</Text>
          <View style={styles.rootControls}>
            <Pressable
              accessibilityLabel="Lower selected root one semitone"
              accessibilityRole="button"
              onPress={onLowerRoot}
              style={styles.rootButton}
            >
              <Text style={styles.rootButtonText}>−</Text>
            </Pressable>
            <Text style={styles.rootValue}>{noteLabel}</Text>
            <Pressable
              accessibilityLabel="Raise selected root one semitone"
              accessibilityRole="button"
              onPress={onRaiseRoot}
              style={styles.rootButton}
            >
              <Text style={styles.rootButtonText}>＋</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.controlRow}>
          <View style={styles.controlGroup}>
            <Text style={styles.label}>QUALITY</Text>
            <View accessibilityRole="radiogroup" style={styles.quality}>
              {(['maj', 'min'] as const).map((quality) => {
                const selected = entry.face.quality === quality;
                return (
                  <Pressable
                    accessibilityLabel={quality === 'maj' ? 'Major chord' : 'Minor chord'}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={quality}
                    onPress={() => onChangeQuality(quality)}
                    style={[styles.qualityOption, selected && styles.qualitySelected]}
                  >
                    <Text style={[styles.qualityText, selected && styles.qualitySelectedText]}>
                      {quality.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.controlGroup}>
            <Text style={styles.label}>LENGTH</Text>
            <HarmonyDurationStepper
              compact
              onValueChange={onChangeDuration}
              value={entry.duration}
            />
          </View>
        </View>

        <Pressable
          accessibilityLabel={`Remove chord ${index + 1}`}
          accessibilityRole="button"
          onPress={onRemove}
          style={styles.remove}
        >
          <Text style={styles.removeText}>⌫ REMOVE CHORD</Text>
        </Pressable>
      </View>
    </ReacticxBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 18,
  },
  header: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eyebrow: { color: '#8AA0FF', fontSize: 6, fontWeight: '900', letterSpacing: 1 },
  chord: { color: '#F7F8FF', fontSize: 15, fontWeight: '800', marginTop: 2 },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
    borderRadius: 18,
  },
  closeText: { color: '#D9DEEA', fontSize: 19 },
  label: { color: '#71808D', fontSize: 5.5, fontWeight: '900', letterSpacing: 0.75 },
  rootRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.08)',
  },
  rootControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rootButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#465269',
  },
  rootButtonText: { color: '#F7F8FF', fontSize: 17 },
  rootValue: {
    minWidth: 48,
    color: '#F3B15A',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '900',
  },
  controlRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.08)',
  },
  controlGroup: { gap: 5 },
  quality: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderRadius: 17,
    backgroundColor: '#272D38',
  },
  qualityOption: {
    minWidth: 48,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  qualitySelected: { backgroundColor: '#F3B15A' },
  qualityText: { color: '#687184', fontSize: 8, fontWeight: '900' },
  qualitySelectedText: { color: '#08090C' },
  remove: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.08)',
  },
  removeText: { color: '#E87BAC', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
});
