// SPDX-License-Identifier: AGPL-3.0-only
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  HARMONY_DURATION_STEPS,
  type HarmonyDuration,
  harmonyDurationLabel,
} from '@/packages/music-core/src/harmony-duration';
import { durationIndexFromPosition } from '@/packages/ui-core/src/chord-duration-lab';

interface HarmonyDurationEditorProps {
  accent: string;
  chordLabel: string;
  duration: HarmonyDuration;
  muted: boolean;
  onDelete: () => void;
  onDurationChange: (duration: HarmonyDuration) => void;
  onMuteToggle: () => void;
}

function ElasticDurationSlider({
  accent,
  onChange,
  value,
}: {
  accent: string;
  onChange: (duration: HarmonyDuration) => void;
  value: HarmonyDuration;
}) {
  const [width, setWidth] = useState(0);
  const interaction = useSharedValue(0);
  const overflow = useSharedValue(0);
  const overflowDirection = useSharedValue(0);
  const selectedIndex = HARMONY_DURATION_STEPS.indexOf(value);
  const progress = selectedIndex / (HARMONY_DURATION_STEPS.length - 1);

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
    const next = HARMONY_DURATION_STEPS[index] ?? 1;
    if (next !== value) {
      onChange(next);
      void Haptics.selectionAsync();
    }
  };

  return (
    <View style={styles.sliderWrap}>
      <Animated.View
        accessibilityLabel={`Chord duration ${harmonyDurationLabel(value)}`}
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
        testID="harmony-duration-slider"
        style={[styles.sliderHit, sliderStyle]}
      >
        <Animated.View style={[styles.elasticTrack, trackStyle]}>
          <View style={styles.track} />
          <View
            style={[styles.trackFill, { backgroundColor: accent, width: `${progress * 100}%` }]}
          />
        </Animated.View>
        {HARMONY_DURATION_STEPS.map((duration, index) => (
          <View
            key={duration}
            style={[
              styles.tick,
              { left: `${(index / (HARMONY_DURATION_STEPS.length - 1)) * 100}%` },
              index <= selectedIndex && { backgroundColor: accent, borderColor: '#fff' },
            ]}
          />
        ))}
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

function EditorAction({
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

export function HarmonyDurationEditor({
  accent,
  chordLabel,
  duration,
  muted,
  onDelete,
  onDurationChange,
  onMuteToggle,
}: HarmonyDurationEditorProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      style={styles.editor}
      testID="harmony-duration-editor"
    >
      <View style={[styles.identity, { borderColor: `${accent}a8` }]}>
        <Text style={[styles.chord, { color: accent }]}>{chordLabel}</Text>
        <Text style={styles.caption}>HOLD</Text>
      </View>
      <View style={styles.sliderColumn}>
        <Text style={[styles.durationValue, { color: accent }]}>
          {harmonyDurationLabel(duration)}
        </Text>
        <ElasticDurationSlider accent={accent} onChange={onDurationChange} value={duration} />
      </View>
      <View style={styles.actions}>
        <EditorAction
          accent={accent}
          active={muted}
          label={muted ? 'Unmute chord' : 'Mute chord'}
          onPress={onMuteToggle}
          symbol="M"
        />
        <EditorAction accent="#e87bac" label="Delete chord" onPress={onDelete} symbol="×" />
      </View>
    </Animated.View>
  );
}

export function HarmonyDurationMarkers({
  duration,
  muted,
}: {
  duration: HarmonyDuration;
  muted: boolean;
}) {
  return (
    <View pointerEvents="none" style={styles.durationMarkers}>
      {duration === 0.5 ? (
        <View style={[styles.halfDurationDot, muted && styles.dotMuted]} />
      ) : (
        Array.from({ length: duration }).map((_, index) => (
          <View key={index} style={[styles.durationDot, muted && styles.dotMuted]} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  editor: {
    width: '100%',
    minHeight: 76,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#04060D',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  identity: { width: 38, height: 46, borderRightWidth: 1, justifyContent: 'center' },
  chord: { fontSize: 16, fontWeight: '900' },
  caption: { color: '#5c647b', fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  sliderColumn: { flex: 1, paddingTop: 2 },
  durationValue: { fontSize: 8, fontWeight: '900', letterSpacing: 0.9, marginBottom: 1 },
  actions: { flexDirection: 'row', gap: 6 },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
  sliderHit: { height: 23, justifyContent: 'center', marginHorizontal: 7 },
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
  durationMarkers: { position: 'absolute', bottom: 3, flexDirection: 'row', gap: 2 },
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
});
