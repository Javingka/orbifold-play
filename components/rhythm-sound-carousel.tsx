// SPDX-License-Identifier: AGPL-3.0-only
// Compact translucent sound selector for the rhythm-orbit dialog.
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

import type { RhythmSoundId, RhythmSoundOption } from '@/packages/music-core/src/rhythm-sounds';

interface RhythmSoundCarouselProps {
  accentColor: string;
  onAudition: (soundId: RhythmSoundId) => void;
  onSelect: (soundId: RhythmSoundId) => void;
  options: readonly RhythmSoundOption[];
  selectedId: RhythmSoundId;
}

interface SoundCardProps {
  accentColor: string;
  index: number;
  item: RhythmSoundOption;
  onPress: () => void;
  scrollX: SharedValue<number>;
  selected: boolean;
}

const ITEM_WIDTH = 106;

function SoundCard({ accentColor, index, item, onPress, scrollX, selected }: SoundCardProps) {
  const inputRange = [(index - 1) * ITEM_WIDTH, index * ITEM_WIDTH, (index + 1) * ITEM_WIDTH];
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0.68, 1, 0.68], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(scrollX.value, inputRange, [0.91, 1, 0.91], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.item, animatedStyle]}>
      <Pressable
        accessibilityHint="Selects this sound and plays a short preview"
        accessibilityLabel={`Select and preview ${item.title} sound`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[
          styles.card,
          selected && styles.cardSelected,
          selected && { borderColor: accentColor },
        ]}
      >
        <BlurView
          intensity={selected ? 0 : 3}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          tint="dark"
        />
        <Text style={[styles.title, selected && styles.titleSelected]}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        {selected ? (
          <View style={[styles.selectedPulse, { backgroundColor: accentColor }]} />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function RhythmSoundCarousel({
  accentColor,
  onAudition,
  onSelect,
  options,
  selectedId,
}: RhythmSoundCarouselProps) {
  const { width } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  const listRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.id === selectedId),
  );
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
    if (option) onSelect(option.id);
  };

  const selectOption = (option: RhythmSoundOption, index: number): void => {
    onSelect(option.id);
    onAudition(option.id);
    listRef.current?.scrollTo({ animated: true, x: index * ITEM_WIDTH });
  };

  React.useEffect(() => {
    listRef.current?.scrollTo({ animated: true, x: selectedIndex * ITEM_WIDTH });
  }, [selectedIndex]);

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
          <SoundCard
            key={item.id}
            accentColor={accentColor}
            index={index}
            item={item}
            onPress={() => selectOption(item, index)}
            scrollX={scrollX}
            selected={item.id === selectedId}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: 64, justifyContent: 'center' },
  list: { flexGrow: 0 },
  item: { width: ITEM_WIDTH, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 96,
    height: 50,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(86, 96, 116, 0.42)',
    backgroundColor: 'rgba(17, 21, 29, 0.78)',
  },
  cardSelected: { backgroundColor: 'rgba(32, 40, 60, 0.88)' },
  title: { color: '#919AAC', fontSize: 9, fontWeight: '800', letterSpacing: 0.65 },
  titleSelected: { color: '#F7F8FF' },
  subtitle: { color: '#626D82', fontSize: 6.5, fontWeight: '700', letterSpacing: 0.45 },
  selectedPulse: { width: 16, height: 2, borderRadius: 1, marginTop: 1 },
});
