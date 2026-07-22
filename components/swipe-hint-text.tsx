// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from ReactICX Animated Text as a compact staggered navigation hint.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

interface SwipeHintTextProps {
  onPress: () => void;
}

interface HintCharacterProps {
  char: string;
  index: number;
  phrase: string;
}

const HINTS = ['SWIPE → RHYTHM', 'TAP TO EXPLORE'] as const;

function HintCharacter({ char, index, phrase }: HintCharacterProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : 5);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }

    const delay = index * 18;
    opacity.value = 0;
    translateY.value = 5;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
  }, [index, opacity, phrase, reduceMotion, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[styles.character, animatedStyle]}>
      {char === ' ' ? '\u00a0' : char}
    </Animated.Text>
  );
}

export function SwipeHintText({ onPress }: SwipeHintTextProps) {
  const [hintIndex, setHintIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const phrase = HINTS[hintIndex] as string;

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setHintIndex((current) => (current + 1) % HINTS.length), 2600);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  return (
    <Pressable
      accessibilityHint="Opens the Rhythm instrument view"
      accessibilityLabel="Swipe right for Rhythm, or tap to open it"
      accessibilityRole="button"
      hitSlop={5}
      onPress={onPress}
      style={styles.trigger}
    >
      <View key={phrase} style={styles.textWrapper}>
        {Array.from(phrase).map((char, index) => (
          <HintCharacter key={`${phrase}:${index}`} char={char} index={index} phrase={phrase} />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'flex-start',
    minHeight: 14,
    justifyContent: 'center',
    marginTop: 2,
  },
  textWrapper: { flexDirection: 'row', alignItems: 'center' },
  character: {
    color: '#8AA0FF',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.7,
    lineHeight: 10,
  },
});
