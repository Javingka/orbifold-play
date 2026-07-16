// SPDX-License-Identifier: AGPL-3.0-only
// ReactICX Morph Loader-inspired fallback that works before CanvasKit is ready.
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export function MorphLoader() {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = reduceMotion
      ? 0.45
      : withRepeat(withTiming(1, { duration: 950, easing: Easing.inOut(Easing.cubic) }), -1, true);
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const shapeStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(progress.value, [0, 0.5, 1], [8, 28, 14]),
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.7, 1, 0.78]),
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [0, 135])}deg` },
      { scale: interpolate(progress.value, [0, 0.5, 1], [0.76, 1, 0.82]) },
      { scaleX: interpolate(progress.value, [0, 0.5, 1], [1, 1.22, 0.9]) },
    ],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.container}
    >
      <View style={styles.loaderFrame}>
        <View style={styles.halo} />
        <Animated.View style={[styles.shape, shapeStyle]}>
          <View style={styles.core} />
        </Animated.View>
      </View>
      <Text style={styles.label}>FORMING INSTRUMENT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 18 },
  loaderFrame: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#8aa0ff',
    opacity: 0.08,
  },
  shape: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8aa0ff',
  },
  core: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#050609', opacity: 0.78 },
  label: { color: '#697184', fontSize: 8, fontWeight: '800', letterSpacing: 1.8 },
});
