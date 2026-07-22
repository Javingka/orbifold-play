// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from ReactICX Blur Carousel as a compact musical-scale selector.
import { BlurView } from 'expo-blur';
import React, { useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { ScaleMode } from '@/packages/music-core/src/scales';

export interface ScaleCarouselOption {
  id: string;
  mode: ScaleMode;
  rootPc: number;
  subtitle: string;
  title: string;
}

interface ScaleBlurCarouselProps {
  onSelect: (option: ScaleCarouselOption) => void;
  options: readonly ScaleCarouselOption[];
  selectedId: string;
  translucent?: boolean;
}

interface ScaleCardProps {
  index: number;
  item: ScaleCarouselOption;
  onPress: () => void;
  scrollX: SharedValue<number>;
  selected: boolean;
  translucent: boolean;
}

const ITEM_WIDTH = 104;

function ScaleCard({ index, item, onPress, scrollX, selected, translucent }: ScaleCardProps) {
  const inputRange = [(index - 1) * ITEM_WIDTH, index * ITEM_WIDTH, (index + 1) * ITEM_WIDTH];
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0.72, 1, 0.72], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(scrollX.value, inputRange, [0.92, 1, 0.92], Extrapolation.CLAMP),
      },
    ],
  }));
  return (
    <Animated.View style={[styles.item, animatedStyle]}>
      <Pressable
        accessibilityLabel={`Select ${item.title} scale`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[
          styles.card,
          translucent && styles.cardTranslucent,
          selected && styles.cardSelected,
          selected && translucent && styles.cardSelectedTranslucent,
        ]}
      >
        <Text style={[styles.title, selected && styles.titleSelected]}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        <BlurView
          intensity={selected ? 0 : translucent ? 2 : 4}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          tint="dark"
        />
      </Pressable>
    </Animated.View>
  );
}

export function ScaleBlurCarousel({
  options,
  selectedId,
  onSelect,
  translucent = false,
}: ScaleBlurCarouselProps) {
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  const listRef = useRef<ScrollView>(null);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const selectAtOffset = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const index = Math.max(
      0,
      Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.x / ITEM_WIDTH)),
    );
    const option = options[index];
    if (option) onSelect(option);
  };

  const selectOption = (option: ScaleCarouselOption, index: number): void => {
    onSelect(option);
    listRef.current?.scrollTo({ animated: true, x: index * ITEM_WIDTH });
  };

  return (
    <View style={styles.wrapper}>
      <Animated.ScrollView
        ref={listRef}
        contentContainerStyle={{ paddingHorizontal: Math.max(0, (width - ITEM_WIDTH) / 2) }}
        decelerationRate="fast"
        horizontal
        nestedScrollEnabled
        onMomentumScrollEnd={selectAtOffset}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        style={styles.list}
      >
        {options.map((item, index) => (
          <ScaleCard
            key={item.id}
            index={index}
            item={item}
            onPress={() => selectOption(item, index)}
            scrollX={scrollX}
            selected={item.id === selectedId}
            translucent={translucent}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: 62, justifyContent: 'center' },
  list: { flexGrow: 0 },
  item: { width: ITEM_WIDTH, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 94,
    height: 48,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#2d3340',
    backgroundColor: '#11151d',
  },
  cardSelected: { borderColor: '#8aa0ff', backgroundColor: '#20283c' },
  cardTranslucent: { backgroundColor: 'rgba(17, 21, 29, 0.62)' },
  cardSelectedTranslucent: { backgroundColor: 'rgba(32, 40, 60, 0.7)' },
  title: { color: '#929bad', fontSize: 9, fontWeight: '800', letterSpacing: 0.65 },
  titleSelected: { color: '#f7f8ff' },
  subtitle: { color: '#596275', fontSize: 7, fontWeight: '700', letterSpacing: 0.5 },
});
