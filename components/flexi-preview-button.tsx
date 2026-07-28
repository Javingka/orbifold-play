// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Reactix Flexi Button: a compact icon expands elastically into
// the active action label. Kept dependency-free to fit the existing app shell.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface FlexiPreviewButtonProps {
  isPlaying: boolean;
  onPress: () => void;
  pauseAccessibilityLabel?: string;
  playAccessibilityLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FlexiPreviewButton({
  isPlaying,
  onPress,
  pauseAccessibilityLabel = 'Pause captured rhythm preview',
  playAccessibilityLabel = 'Listen to captured rhythm',
}: FlexiPreviewButtonProps) {
  const progress = useSharedValue(isPlaying ? 1 : 0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = reduceMotion
      ? isPlaying
        ? 1
        : 0
      : withSpring(isPlaying ? 1 : 0, { damping: 14, stiffness: 210 });
  }, [isPlaying, progress, reduceMotion]);

  const buttonStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [72, 128], Extrapolation.CLAMP),
    backgroundColor: progress.value > 0.5 ? '#E87BAC' : '#F7F8FF',
  }));
  const playIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 0.72], Extrapolation.CLAMP) }],
  }));
  const pauseTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.25, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.82, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <AnimatedPressable
      accessibilityLabel={isPlaying ? pauseAccessibilityLabel : playAccessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: isPlaying }}
      onPress={onPress}
      style={[styles.button, buttonStyle]}
    >
      <Animated.Text style={[styles.playIcon, playIconStyle]}>▶</Animated.Text>
      <Animated.View pointerEvents="none" style={[styles.pauseContent, pauseTextStyle]}>
        <Text style={styles.pauseText}>Ⅱ PAUSE</Text>
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 999,
  },
  playIcon: { color: '#08090C', fontSize: 18, fontWeight: '900' },
  pauseContent: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pauseText: { color: '#08090C', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
});
