// SPDX-License-Identifier: AGPL-3.0-only
// ReactICX-inspired rolling counter for React Native. Each digit is a vertical
// 0–9 strip clipped to one line; when the value changes the strip slides to the
// new digit, so a countdown "rolls" instead of hard-cutting. Reanimated only —
// no new dependency.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface RollingCounterProps {
  value: number;
  color?: string;
  durationMs?: number;
  fontSize?: number;
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function RollingDigit({
  color,
  digit,
  durationMs,
  fontSize,
}: {
  color: string;
  digit: number;
  durationMs: number;
  fontSize: number;
}) {
  const lineHeight = Math.round(fontSize * 1.16);
  const offset = useSharedValue(digit);

  useEffect(() => {
    offset.value = withTiming(digit, { duration: durationMs, easing: Easing.out(Easing.cubic) });
  }, [digit, durationMs, offset]);

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -offset.value * lineHeight }],
  }));

  return (
    <View style={{ height: lineHeight, width: fontSize * 0.66, overflow: 'hidden' }}>
      <Animated.View style={stripStyle}>
        {DIGITS.map((d) => (
          <Text
            key={d}
            style={[
              styles.digit,
              { color, fontSize, height: lineHeight, lineHeight },
            ]}
          >
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/** A non-negative integer whose digits roll when the value changes. */
export function RollingCounter({
  color = '#F7F8FF',
  durationMs = 420,
  fontSize = 48,
  value,
}: RollingCounterProps) {
  const digits = String(Math.max(0, Math.round(value))).split('').map(Number);
  return (
    <View accessibilityLabel={String(Math.max(0, Math.round(value)))} style={styles.row}>
      {digits.map((digit, index) => (
        <RollingDigit
          color={color}
          digit={digit}
          durationMs={durationMs}
          fontSize={fontSize}
          key={`${digits.length}-${index}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  digit: {
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
