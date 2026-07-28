// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from Reactix Bottom Sheet for Orbifold Play's single-snap editor.
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

interface Props {
  enableBackdrop?: boolean;
  backdropOpacity?: number;
  children: React.ReactNode;
  height: number;
  onClose: () => void;
  visible: boolean;
}

const SPRING = { damping: 22, mass: 0.75, stiffness: 220 };

export function ReacticxBottomSheet({
  enableBackdrop = true,
  backdropOpacity = 0.18,
  children,
  height,
  onClose,
  visible,
}: Props) {
  const translateY = useSharedValue(height);
  const dragOrigin = useSharedValue(0);

  useEffect(() => {
    translateY.value = visible
      ? withSpring(0, SPRING)
      : withTiming(height, { duration: 180 });
  }, [height, translateY, visible]);

  const closeFromGesture = (): void => {
    onClose();
  };

  const drag = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      dragOrigin.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.max(0, dragOrigin.value + event.translationY);
    })
    .onEnd((event) => {
      const shouldClose = translateY.value > height * 0.2 || event.velocityY > 650;
      if (shouldClose) {
        translateY.value = withTiming(height, { duration: 170 }, (finished) => {
          if (finished) scheduleOnRN(closeFromGesture);
        });
        return;
      }
      translateY.value = withSpring(0, SPRING);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, height],
      [backdropOpacity, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View pointerEvents={visible ? 'box-none' : 'none'} style={styles.layer}>
      {enableBackdrop ? (
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            accessibilityLabel="Close chord editor"
            accessibilityRole="button"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      <Animated.View
        accessibilityViewIsModal
        style={[styles.sheet, { height }, sheetStyle]}
      >
        <GestureDetector gesture={drag}>
          <View accessibilityLabel="Drag down to close chord editor" style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    inset: 0,
    zIndex: 130,
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#000000',
  },
  sheet: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(138,160,255,.42)',
    backgroundColor: '#101721',
    shadowColor: '#000000',
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  handleArea: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#69778D',
  },
});
