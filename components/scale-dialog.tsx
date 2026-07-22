// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from ReactICX Dialog for a transparent, stage-local scale picker.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ScaleBlurCarousel, type ScaleCarouselOption } from '@/components/scale-blur-carousel';

interface ScaleDialogProps {
  onClose: () => void;
  onSelect: (option: ScaleCarouselOption) => void;
  options: readonly ScaleCarouselOption[];
  selectedId: string;
  visible: boolean;
}

const EXIT_DURATION = 220;

export function ScaleDialog({ onClose, onSelect, options, selectedId, visible }: ScaleDialogProps) {
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);
  const reduceMotion = useReducedMotion();
  const selected = useMemo(
    () => options.find((option) => option.id === selectedId),
    [options, selectedId],
  );

  useEffect(() => {
    let frame: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const duration = reduceMotion ? 0 : visible ? 360 : EXIT_DURATION;

    if (visible) {
      setMounted(true);
      progress.value = reduceMotion ? 1 : 0;
      frame = requestAnimationFrame(() => {
        progress.value = withTiming(1, {
          duration,
          easing: Easing.out(Easing.cubic),
        });
      });
    } else {
      progress.value = withTiming(0, {
        duration,
        easing: Easing.in(Easing.cubic),
      });
      timer = setTimeout(() => setMounted(false), duration);
    }

    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [progress, reduceMotion, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.65, 1], Extrapolation.CLAMP),
    transform: [
      { perspective: 1000 },
      {
        rotateX: `${interpolate(progress.value, [0, 1], [-18, 0], Extrapolation.CLAMP)}deg`,
      },
      { translateY: interpolate(progress.value, [0, 1], [14, 0], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [0.88, 1], Extrapolation.CLAMP) },
    ],
  }));

  if (!mounted) return null;

  return (
    <View
      accessibilityViewIsModal={visible}
      pointerEvents={visible ? 'auto' : 'none'}
      style={styles.root}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable
          accessibilityLabel="Close scale menu"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.content, contentStyle]}>
        <View style={styles.dialogHeader}>
          <View>
            <Text style={styles.eyebrow}>MUSICAL SCALE</Text>
            <Text style={styles.currentScale}>{selected?.title ?? 'SELECT SCALE'}</Text>
          </View>
          <Pressable
            accessibilityLabel="Close scale menu"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>
        </View>
        <ScaleBlurCarousel
          onSelect={onSelect}
          options={options}
          selectedId={selectedId}
          translucent
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  backdrop: { backgroundColor: 'rgba(5, 6, 9, 0.2)' },
  content: {
    width: '100%',
    maxWidth: 430,
    minHeight: 102,
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 6, 9, 0.12)',
    borderColor: 'rgba(138, 160, 255, 0.2)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingTop: 4,
    paddingBottom: 7,
  },
  dialogHeader: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  eyebrow: { color: '#727d94', fontSize: 6, fontWeight: '800', letterSpacing: 1.25 },
  currentScale: {
    color: '#F7F8FF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  closeButton: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: 'rgba(20, 24, 34, 0.58)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
  },
  closeGlyph: { color: '#D9DEEA', fontSize: 17, fontWeight: '400', lineHeight: 19 },
});
