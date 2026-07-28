// SPDX-License-Identifier: AGPL-3.0-only
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HarmonyCaptureAnalysis } from '@/packages/music-core/src/harmony-capture';
import type { HarmonyDuration } from '@/packages/music-core/src/harmony-duration';
import {
  resolveHarmonyPlayhead,
  type HarmonyPlayhead,
} from '@/packages/music-core/src/harmony-playhead';

const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
] as const;
const BAR_WIDTH = 64;
const ROW_HEIGHT = 34;
interface Props {
  analysis: HarmonyCaptureAnalysis;
  getCycle: () => number | null;
  isPlaying: boolean;
  onSelect: (index: number | null) => void;
  selectedIndex: number | null;
}

function noteName(midi: number): string {
  const rounded = Math.round(midi);
  return `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}

function segmentWidth(duration: HarmonyDuration): number {
  return Math.max(44, duration * BAR_WIDTH);
}

export function HarmonyCaptureRoll({
  analysis,
  getCycle,
  isPlaying,
  onSelect,
  selectedIndex,
}: Props) {
  const entries = analysis.entries;
  const [playhead, setPlayhead] = useState<HarmonyPlayhead | null>(null);
  const timelineRef = useRef<ScrollView>(null);
  const durationKey = entries.map((entry) => entry.duration).join(':');
  const rows = useMemo(() => {
    if (entries.length === 0) return [60];
    const pitches = entries.map((entry) => entry.midi);
    const minimum = Math.min(...pitches) - 1;
    const maximum = Math.max(...pitches) + 1;
    if (maximum - minimum <= 14) {
      return Array.from(
        { length: maximum - minimum + 1 },
        (_, index) => maximum - index,
      );
    }
    const focused = new Set<number>();
    for (const pitch of pitches) {
      focused.add(pitch + 1);
      focused.add(pitch);
      focused.add(pitch - 1);
    }
    return [...focused].sort((a, b) => b - a);
  }, [entries]);

  useEffect(() => {
    if (!isPlaying || entries.length === 0) {
      setPlayhead(null);
      return;
    }
    const updatePlayhead = (): void => {
      const cycle = getCycle();
      setPlayhead(
        cycle === null
          ? null
          : resolveHarmonyPlayhead(
              cycle,
              entries.map((entry) => entry.duration),
            ),
      );
    };
    updatePlayhead();
    const timer = setInterval(updatePlayhead, 32);
    return () => clearInterval(timer);
  }, [durationKey, entries.length, getCycle, isPlaying]);

  useEffect(() => {
    if (playhead === null) return;
    const left = entries
      .slice(0, playhead.activeIndex)
      .reduce((sum, entry) => sum + segmentWidth(entry.duration), 0);
    timelineRef.current?.scrollTo({ animated: true, x: Math.max(0, left - BAR_WIDTH) });
  }, [entries, playhead?.activeIndex]);

  return (
    <View>
      <Text style={styles.heading}>CAPTURED MELODY → CHORD ROOTS</Text>
      <Text style={styles.help}>
        Tap anywhere in a column to select it. Edit the root only from the chord panel.
      </Text>
      <View style={styles.rollArea}>
        {selectedIndex !== null ? (
          <Pressable
            accessibilityLabel="Close chord editor"
            accessibilityRole="button"
            onPress={() => onSelect(null)}
            style={styles.dismissArea}
          />
        ) : null}
        <View pointerEvents="box-none" style={styles.rollFrame}>
          <View pointerEvents="none" style={styles.pitchLabels}>
            <View style={styles.corner}>
              <Text style={styles.cornerText}>NOTE</Text>
            </View>
            {rows.map((midi) => (
              <View key={midi} style={styles.pitchLabel}>
                <Text
                  style={[
                    styles.pitchLabelText,
                    midi % 12 === 0 && styles.cLabel,
                  ]}
                >
                  {noteName(midi)}
                </Text>
              </View>
            ))}
          </View>
          <ScrollView
            horizontal
            nestedScrollEnabled
            ref={timelineRef}
            showsHorizontalScrollIndicator
            style={styles.timelineScroll}
          >
            <View>
              <View style={styles.timelineHeader}>
                {entries.map((entry, index) => (
                  <Pressable
                    accessibilityLabel={`Select chord ${index + 1}, ${noteName(entry.midi)}, ${entry.duration} bars`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: index === selectedIndex }}
                    key={`head:${index}`}
                    onPress={() => onSelect(index)}
                    style={[
                      styles.timelineHeaderCell,
                      { width: segmentWidth(entry.duration) },
                      index === selectedIndex && styles.selectedHeader,
                    ]}
                  >
                    <Text style={styles.timelineHeaderText}>
                      {String(index + 1).padStart(2, '0')} · {entry.duration}×
                    </Text>
                  </Pressable>
                ))}
              </View>
              {rows.map((midi) => (
                <View key={midi} style={styles.pitchRow}>
                  {entries.map((entry, index) => {
                    const active = entry.midi === midi;
                    const selectedCell = index === selectedIndex;
                    return (
                      <Pressable
                        accessibilityLabel={`Select chord ${index + 1}, current root ${noteName(entry.midi)}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: selectedCell }}
                        key={`${midi}:${index}`}
                        onPress={() => onSelect(index)}
                        style={[
                          styles.cell,
                          { width: segmentWidth(entry.duration) },
                          selectedCell && styles.selectedColumn,
                          active && styles.noteBlock,
                          active && selectedCell && styles.selectedNoteBlock,
                        ]}
                      >
                        {active ? (
                          <Text style={styles.noteBlockText}>
                            {noteName(entry.midi)}
                            {entry.face.quality === 'min' ? 'm' : ''}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              {playhead ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.playhead,
                    {
                      left:
                        entries
                          .slice(0, playhead.activeIndex)
                          .reduce(
                            (sum, entry) => sum + segmentWidth(entry.duration),
                            0,
                          ) +
                        playhead.phase *
                          segmentWidth(entries[playhead.activeIndex]?.duration ?? 1),
                    },
                  ]}
                >
                  <Text style={styles.playheadLabel}>NOW</Text>
                  <View style={styles.playheadCap} />
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: '#F7F8FF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 12,
  },
  help: { color: '#71808D', fontSize: 7, lineHeight: 11, marginVertical: 6 },
  rollArea: { position: 'relative' },
  dismissArea: { position: 'absolute', inset: 0 },
  rollFrame: {
    zIndex: 1,
    maxHeight: 560,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#293245',
    backgroundColor: '#090D14',
  },
  pitchLabels: { width: 42, backgroundColor: '#101620' },
  corner: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#293245',
  },
  cornerText: { color: '#657188', fontSize: 5.5, fontWeight: '800' },
  pitchLabel: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1B2230',
  },
  pitchLabelText: { color: '#71808D', fontSize: 7, fontWeight: '700' },
  cLabel: { color: '#F3B15A' },
  timelineScroll: { flex: 1 },
  timelineHeader: { height: 28, flexDirection: 'row' },
  timelineHeaderCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#293245',
  },
  selectedHeader: { backgroundColor: 'rgba(138,160,255,.16)' },
  timelineHeaderText: { color: '#71808D', fontSize: 6, fontWeight: '800' },
  pitchRow: { height: ROW_HEIGHT, flexDirection: 'row' },
  cell: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#171F2C',
    backgroundColor: '#0D131D',
  },
  selectedColumn: { backgroundColor: '#111928' },
  noteBlock: {
    backgroundColor: 'rgba(86,207,196,.7)',
    borderColor: '#56CFC4',
  },
  selectedNoteBlock: {
    backgroundColor: '#F3B15A',
    borderColor: '#FFD08A',
  },
  noteBlockText: { color: '#07100F', fontSize: 8, fontWeight: '900' },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#56CFC4',
    shadowOpacity: 0.95,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  playheadCap: {
    position: 'absolute',
    top: 2,
    left: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#56CFC4',
  },
  playheadLabel: {
    position: 'absolute',
    top: 12,
    left: -9,
    color: '#56CFC4',
    fontSize: 5.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
