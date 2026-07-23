// SPDX-License-Identifier: AGPL-3.0-only
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

import { durationIndexFromPosition } from '@/packages/ui-core/src/chord-duration-lab';
import {
  HARMONY_DURATION_STEPS as CHORD_DURATION_STEPS,
  type HarmonyDuration as ChordDuration,
  harmonyDurationLabel as durationLabel,
} from '@/packages/music-core/src/harmony-duration';

interface LabChord {
  color: string;
  duration: ChordDuration;
  id: string;
  label: string;
  muted: boolean;
}

interface DurationSliderProps {
  accent: string;
  compact?: boolean;
  onChange: (duration: ChordDuration) => void;
  value: ChordDuration;
}

interface DurationEditorProps {
  chord: LabChord;
  onDelete: () => void;
  onDuration: (duration: ChordDuration) => void;
  onMute: () => void;
}

const INITIAL_CHORDS: readonly LabChord[] = [
  { id: 'c', label: 'C', color: '#f3b15a', duration: 1, muted: false },
  { id: 'am', label: 'Am', color: '#ff745f', duration: 1, muted: false },
  { id: 'f', label: 'F', color: '#56cfc4', duration: 1, muted: false },
  { id: 'g', label: 'G', color: '#e87bac', duration: 1, muted: false },
];

function DurationSlider({ accent, compact = false, onChange, value }: DurationSliderProps) {
  const [width, setWidth] = useState(0);
  const interaction = useSharedValue(0);
  const overflow = useSharedValue(0);
  const overflowDirection = useSharedValue(0);
  const selectedIndex = CHORD_DURATION_STEPS.indexOf(value);
  const progress = selectedIndex / (CHORD_DURATION_STEPS.length - 1);

  const sliderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(interaction.value, [0, 1], [0.82, 1]),
    transform: [{ scale: interpolate(interaction.value, [0, 1], [1, 1.018]) }],
  }));

  const trackStyle = useAnimatedStyle(() => {
    const elasticDistance = Math.min(10, overflow.value);
    const safeWidth = Math.max(1, width);
    return {
      height: interpolate(interaction.value, [0, 1], [3, 5]),
      transform: [
        { translateX: overflowDirection.value * elasticDistance * 0.14 },
        { scaleX: 1 + elasticDistance / (safeWidth * 1.8) },
        { scaleY: interpolate(elasticDistance, [0, 10], [1, 0.92]) },
      ],
    };
  });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(interaction.value, [0, 1], [1, 1.12]) }],
  }));

  const release = (): void => {
    interaction.value = withSpring(0, { damping: 14, stiffness: 190 });
    overflow.value = withSpring(0, { damping: 11, stiffness: 155 });
    overflowDirection.value = 0;
  };

  const update = (event: GestureResponderEvent): void => {
    const x = event.nativeEvent.locationX;
    if (x < 0) {
      overflowDirection.value = -1;
      overflow.value = Math.sqrt(-x) * 2.2;
    } else if (x > width) {
      overflowDirection.value = 1;
      overflow.value = Math.sqrt(x - width) * 2.2;
    } else {
      overflowDirection.value = 0;
      overflow.value = 0;
    }

    const index = durationIndexFromPosition(x, width);
    const next = CHORD_DURATION_STEPS[index] ?? 1;
    if (next !== value) {
      onChange(next);
      void Haptics.selectionAsync();
    }
  };

  return (
    <View style={styles.sliderWrap}>
      <Animated.View
        accessibilityLabel={`Chord duration ${durationLabel(value)}`}
        accessibilityRole="adjustable"
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => {
          interaction.value = withSpring(1, { damping: 13, stiffness: 210 });
          update(event);
        }}
        onResponderMove={update}
        onResponderRelease={release}
        onResponderTerminate={release}
        onStartShouldSetResponder={() => true}
        testID="duration-slider"
        style={[styles.sliderHit, compact && styles.sliderHitCompact, sliderStyle]}
      >
        <Animated.View style={[styles.elasticTrack, trackStyle]}>
          <View style={styles.track} />
          <View
            style={[styles.trackFill, { backgroundColor: accent, width: `${progress * 100}%` }]}
          />
        </Animated.View>
        {CHORD_DURATION_STEPS.map((duration, index) => {
          const active = index <= selectedIndex;
          return (
            <View
              key={duration}
              style={[
                styles.tick,
                { left: `${(index / (CHORD_DURATION_STEPS.length - 1)) * 100}%` },
                active && { backgroundColor: accent, borderColor: '#fff' },
              ]}
            />
          );
        })}
        <Animated.View
          layout={LinearTransition.springify().damping(15)}
          style={[
            styles.thumb,
            thumbStyle,
            {
              backgroundColor: '#f8f9ff',
              borderColor: accent,
              left: `${progress * 100}%`,
              shadowColor: accent,
            },
          ]}
        />
      </Animated.View>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>½</Text>
        <Text style={styles.sliderLabel}>1</Text>
        <Text style={styles.sliderLabel}>2</Text>
        <Text style={styles.sliderLabel}>3</Text>
        <Text style={styles.sliderLabel}>4</Text>
      </View>
    </View>
  );
}

function ActionButton({
  accent,
  active = false,
  label,
  onPress,
  symbol,
}: {
  accent: string;
  active?: boolean;
  label: string;
  onPress: () => void;
  symbol: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => {
        onPress();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      style={({ pressed }) => [
        styles.actionButton,
        active && { backgroundColor: accent, borderColor: '#fff' },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.actionSymbol, active && styles.actionSymbolActive]}>{symbol}</Text>
    </Pressable>
  );
}

function SequenceBadges({
  chords,
  onSelect,
  selectedId,
}: {
  chords: readonly LabChord[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <View style={styles.badgeRow}>
      {chords.length === 0 ? (
        <Text style={styles.empty}>ALL CHORDS REMOVED · TAP RESET</Text>
      ) : (
        chords.map((chord, index) => {
          const selected = chord.id === selectedId;
          return (
            <Pressable
              key={chord.id}
              accessibilityLabel={`${chord.label}, ${durationLabel(chord.duration)}${
                chord.muted ? ', muted' : ''
              }. Tap to edit.`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                onSelect(chord.id);
                void Haptics.selectionAsync();
              }}
              style={({ pressed }) => [
                styles.badge,
                {
                  backgroundColor: chord.muted ? `${chord.color}24` : `${chord.color}d9`,
                  borderColor: selected ? '#fff' : `${chord.color}a8`,
                  shadowColor: chord.color,
                },
                selected && styles.badgeSelected,
                pressed && styles.badgePressed,
              ]}
            >
              <Text style={styles.badgeIndex}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={[styles.badgeLabel, chord.muted && styles.badgeMuted]}>
                {chord.label}
              </Text>
              <View style={styles.durationDots}>
                {chord.duration === 0.5 ? (
                  <View style={[styles.halfDurationDot, chord.muted && styles.dotMuted]} />
                ) : (
                  Array.from({ length: chord.duration }).map((_, dot) => (
                    <View key={dot} style={[styles.durationDot, chord.muted && styles.dotMuted]} />
                  ))
                )}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

function useChordPrototype() {
  const [chords, setChords] = useState<readonly LabChord[]>(INITIAL_CHORDS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => chords.find((chord) => chord.id === selectedId) ?? null,
    [chords, selectedId],
  );

  const update = (id: string, patch: Partial<LabChord>): void => {
    setChords((current) =>
      current.map((chord) => (chord.id === id ? { ...chord, ...patch } : chord)),
    );
  };

  return {
    chords,
    selected,
    selectedId,
    dismiss: () => setSelectedId(null),
    select: (id: string) => setSelectedId((current) => (current === id ? null : id)),
    duration: (duration: ChordDuration) => {
      if (selected) update(selected.id, { duration });
    },
    mute: () => {
      if (selected) update(selected.id, { muted: !selected.muted });
    },
    remove: () => {
      if (!selected) return;
      setChords((current) => current.filter((chord) => chord.id !== selected.id));
      setSelectedId(null);
    },
    reset: () => {
      setChords(INITIAL_CHORDS);
      setSelectedId(null);
    },
  };
}

function PrototypeHeader({
  index,
  name,
  note,
  onReset,
  recommendation,
}: {
  index: string;
  name: string;
  note: string;
  onReset: () => void;
  recommendation?: boolean;
}) {
  return (
    <View style={styles.prototypeHeader}>
      <View style={styles.prototypeNumber}>
        <Text style={styles.prototypeNumberText}>{index}</Text>
      </View>
      <View style={styles.prototypeCopy}>
        <View style={styles.nameRow}>
          <Text style={styles.prototypeName}>{name}</Text>
          {recommendation ? <Text style={styles.recommended}>RECOMMENDED</Text> : null}
        </View>
        <Text style={styles.prototypeNote}>{note}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onReset} style={styles.resetButton}>
        <Text style={styles.resetText}>RESET</Text>
      </Pressable>
    </View>
  );
}

function InlineRailEditor({ chord, onDelete, onDuration, onMute }: DurationEditorProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      style={styles.inlineEditor}
    >
      <View style={[styles.editorIdentity, { borderColor: `${chord.color}a8` }]}>
        <Text style={[styles.editorChord, { color: chord.color }]}>{chord.label}</Text>
        <Text style={styles.editorCaption}>HOLD</Text>
      </View>
      <View style={styles.inlineSliderColumn}>
        <Text style={[styles.durationValue, { color: chord.color }]}>
          {durationLabel(chord.duration)}
        </Text>
        <DurationSlider accent={chord.color} compact onChange={onDuration} value={chord.duration} />
      </View>
      <View style={styles.actionsInline}>
        <ActionButton
          accent={chord.color}
          active={chord.muted}
          label={chord.muted ? 'Unmute chord' : 'Mute chord'}
          onPress={onMute}
          symbol="M"
        />
        <ActionButton accent="#e87bac" label="Delete chord" onPress={onDelete} symbol="×" />
      </View>
    </Animated.View>
  );
}

function ElasticRailPrototype() {
  const prototype = useChordPrototype();
  return (
    <View style={styles.prototypeCard} testID="duration-option-elastic">
      {prototype.selected ? (
        <Pressable
          accessibilityLabel="Close chord duration editor"
          accessibilityRole="button"
          onPress={prototype.dismiss}
          style={styles.dismissLayer}
          testID="duration-editor-dismiss"
        />
      ) : null}
      <PrototypeHeader
        index="01"
        name="ELASTIC RAIL"
        note="The badge unfolds inline. Fastest, smallest context switch."
        onReset={prototype.reset}
        recommendation
      />
      <SequenceBadges
        chords={prototype.chords}
        onSelect={prototype.select}
        selectedId={prototype.selectedId}
      />
      {prototype.selected ? (
        <>
          <InlineRailEditor
            chord={prototype.selected}
            onDelete={prototype.remove}
            onDuration={prototype.duration}
            onMute={prototype.mute}
          />
          <Text style={styles.dismissHint}>TAP OUTSIDE THE EDITOR TO CLOSE</Text>
        </>
      ) : (
        <Text style={styles.tapHint}>TAP A BADGE · NOTHING IS DELETED ON FIRST TAP</Text>
      )}
    </View>
  );
}

function GlassPopoverPrototype() {
  const prototype = useChordPrototype();
  const selectedIndex = prototype.chords.findIndex((chord) => chord.id === prototype.selectedId);
  const pointerLeft = Math.max(22, Math.min(254, selectedIndex * 67 + 30));

  return (
    <View style={styles.prototypeCard} testID="duration-option-popover">
      <PrototypeHeader
        index="02"
        name="GLASS POPOVER"
        note="A local pod preserves the strip geometry and points to its chord."
        onReset={prototype.reset}
      />
      <SequenceBadges
        chords={prototype.chords}
        onSelect={prototype.select}
        selectedId={prototype.selectedId}
      />
      {prototype.selected ? (
        <Animated.View
          entering={ZoomIn.duration(190)}
          exiting={ZoomOut.duration(120)}
          style={styles.popoverWrap}
        >
          <View
            style={[
              styles.pointer,
              { left: pointerLeft, borderBottomColor: `${prototype.selected.color}5c` },
            ]}
          />
          <BlurView intensity={24} style={styles.popoverBlur} tint="dark">
            <View style={styles.popoverCopy}>
              <Text style={[styles.popoverChord, { color: prototype.selected.color }]}>
                {prototype.selected.label}
              </Text>
              <Text style={styles.popoverMeta}>
                DURATION · {durationLabel(prototype.selected.duration)}
              </Text>
              <DurationSlider
                accent={prototype.selected.color}
                onChange={prototype.duration}
                value={prototype.selected.duration}
              />
            </View>
            <View style={styles.popoverActions}>
              <ActionButton
                accent={prototype.selected.color}
                active={prototype.selected.muted}
                label={prototype.selected.muted ? 'Unmute chord' : 'Mute chord'}
                onPress={prototype.mute}
                symbol="M"
              />
              <ActionButton
                accent="#e87bac"
                label="Delete chord"
                onPress={prototype.remove}
                symbol="×"
              />
            </View>
          </BlurView>
        </Animated.View>
      ) : (
        <Text style={styles.tapHint}>TAP A BADGE · THE EDITOR STAYS ANCHORED TO IT</Text>
      )}
    </View>
  );
}

function PocketSheetPrototype() {
  const prototype = useChordPrototype();
  return (
    <View style={[styles.prototypeCard, styles.pocketCard]} testID="duration-option-sheet">
      <PrototypeHeader
        index="03"
        name="POCKET SHEET"
        note="A mini sheet gives duration more space and the clearest labels."
        onReset={prototype.reset}
      />
      <SequenceBadges
        chords={prototype.chords}
        onSelect={prototype.select}
        selectedId={prototype.selectedId}
      />
      {prototype.selected ? (
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          exiting={SlideOutDown.duration(150)}
          style={styles.sheet}
        >
          <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTopLine}>
            <View>
              <Text style={styles.sheetEyebrow}>SUSTAINING</Text>
              <Text style={[styles.sheetChord, { color: prototype.selected.color }]}>
                {prototype.selected.label}
              </Text>
            </View>
            <Animated.Text
              entering={FadeIn.duration(140)}
              key={prototype.selected.duration}
              style={styles.sheetDuration}
            >
              {durationLabel(prototype.selected.duration)}
            </Animated.Text>
            <View style={styles.sheetActions}>
              <ActionButton
                accent={prototype.selected.color}
                active={prototype.selected.muted}
                label={prototype.selected.muted ? 'Unmute chord' : 'Mute chord'}
                onPress={prototype.mute}
                symbol="M"
              />
              <ActionButton
                accent="#e87bac"
                label="Delete chord"
                onPress={prototype.remove}
                symbol="×"
              />
            </View>
          </View>
          <DurationSlider
            accent={prototype.selected.color}
            onChange={prototype.duration}
            value={prototype.selected.duration}
          />
          <Text style={styles.sheetFootnote}>CURRENT SOUND REMAINS THE DEFAULT AT 1 BAR</Text>
        </Animated.View>
      ) : (
        <Text style={styles.tapHint}>TAP A BADGE · THE CONTROL RISES FROM THE CARD</Text>
      )}
    </View>
  );
}

export function ChordDurationLab() {
  return (
    <View style={styles.lab}>
      <ElasticRailPrototype />
      <GlassPopoverPrototype />
      <PocketSheetPrototype />
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>SHARED BEHAVIOR</Text>
        <Text style={styles.legendText}>
          1 BAR = TODAY&apos;S DEFAULT · MUTE KEEPS THE TIME SLOT · × REMOVES IT
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lab: { gap: 14 },
  prototypeCard: {
    minHeight: 228,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(138,160,255,0.17)',
    backgroundColor: 'rgba(15,18,30,0.92)',
    padding: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  pocketCard: { minHeight: 252 },
  prototypeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 17 },
  prototypeNumber: {
    width: 29,
    height: 29,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(138,160,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(138,160,255,0.08)',
  },
  prototypeNumberText: { color: '#8aa0ff', fontSize: 8, fontWeight: '900' },
  prototypeCopy: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prototypeName: { color: '#f5f6ff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  prototypeNote: { color: '#747d94', fontSize: 8, lineHeight: 12, fontWeight: '600' },
  recommended: {
    color: '#07100f',
    fontSize: 6,
    fontWeight: '900',
    letterSpacing: 0.6,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#56cfc4',
  },
  resetButton: { zIndex: 3, paddingHorizontal: 6, paddingVertical: 8 },
  resetText: { color: '#596177', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  badgeRow: { zIndex: 3, minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 7 },
  badge: {
    width: 59,
    height: 36,
    paddingHorizontal: 7,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  badgeSelected: { borderWidth: 1.5, shadowOpacity: 0.82, shadowRadius: 9 },
  badgePressed: { transform: [{ scale: 0.94 }] },
  badgeIndex: { color: 'rgba(255,255,255,0.62)', fontSize: 6, fontWeight: '900' },
  badgeLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    textShadowColor: '#0008',
    textShadowRadius: 2,
  },
  badgeMuted: { opacity: 0.54 },
  durationDots: { position: 'absolute', bottom: 4, flexDirection: 'row', gap: 2 },
  durationDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#fff' },
  halfDurationDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  dotMuted: { opacity: 0.35 },
  dismissLayer: { position: 'absolute', inset: 0, zIndex: 2 },
  dismissHint: {
    zIndex: 1,
    alignSelf: 'center',
    color: '#4d566b',
    fontSize: 6,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 7,
  },
  empty: { color: '#5e667c', fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  tapHint: { color: '#4f576d', fontSize: 7, fontWeight: '800', letterSpacing: 0.9, marginTop: 27 },
  inlineEditor: {
    zIndex: 3,
    marginTop: 15,
    minHeight: 83,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(4,6,13,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  editorIdentity: { width: 38, height: 48, borderRightWidth: 1, justifyContent: 'center' },
  editorChord: { fontSize: 17, fontWeight: '900' },
  editorCaption: { color: '#5c647b', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  inlineSliderColumn: { zIndex: 3, flex: 1, paddingTop: 2 },
  durationValue: { fontSize: 8, fontWeight: '900', letterSpacing: 0.9, marginBottom: 2 },
  actionsInline: { zIndex: 3, flexDirection: 'row', gap: 6 },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.17)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSymbol: { color: '#aeb5c8', fontSize: 13, fontWeight: '800' },
  actionSymbolActive: { color: '#07100f' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.91 }] },
  sliderWrap: { flex: 1 },
  sliderHit: { height: 30, justifyContent: 'center', marginHorizontal: 7 },
  sliderHitCompact: { height: 24 },
  elasticTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 99,
    overflow: 'hidden',
  },
  track: {
    position: 'absolute',
    inset: 0,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  trackFill: { position: 'absolute', left: 0, height: '100%', borderRadius: 99 },
  tick: {
    position: 'absolute',
    marginLeft: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#4f576b',
    backgroundColor: '#1c2130',
  },
  thumb: {
    position: 'absolute',
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    shadowOpacity: 0.9,
    shadowRadius: 7,
  },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { color: '#555e74', fontSize: 6, fontWeight: '800' },
  popoverWrap: { marginTop: 10, minHeight: 101 },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  popoverBlur: {
    minHeight: 91,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(11,14,25,0.62)',
    padding: 10,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  popoverCopy: { flex: 1, paddingRight: 12 },
  popoverChord: { fontSize: 15, fontWeight: '900' },
  popoverMeta: {
    color: '#858da2',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 1,
  },
  popoverActions: { justifyContent: 'center', gap: 6 },
  sheet: {
    marginHorizontal: -14,
    marginBottom: -14,
    marginTop: 12,
    minHeight: 139,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(138,160,255,0.2)',
    backgroundColor: 'rgba(8,11,20,0.73)',
    overflow: 'hidden',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#596178',
    marginBottom: 9,
  },
  sheetTopLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetEyebrow: { color: '#596177', fontSize: 6, fontWeight: '900', letterSpacing: 0.7 },
  sheetChord: { fontSize: 18, fontWeight: '900', minWidth: 32 },
  sheetDuration: {
    flex: 1,
    color: '#f4f6ff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  sheetActions: { flexDirection: 'row', gap: 6 },
  sheetFootnote: {
    color: '#4e566c',
    fontSize: 6,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 3,
  },
  legend: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(86,207,196,0.14)',
    backgroundColor: 'rgba(86,207,196,0.035)',
    padding: 14,
  },
  legendTitle: {
    color: '#56cfc4',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  legendText: {
    color: '#697188',
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 13,
    letterSpacing: 0.5,
  },
});
