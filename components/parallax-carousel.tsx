// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from ReactICX Parallax Carousel for arbitrary interactive instrument pages.
import React, { useEffect, useRef } from 'react';
import type { FlatList, ViewToken } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

export interface ParallaxCarouselPage {
  id: string;
  content: React.ReactNode;
}

interface ParallaxCarouselProps {
  itemWidth: number;
  onIndexChange: (index: number) => void;
  pages: readonly ParallaxCarouselPage[];
  parallaxIntensity?: number;
  selectedIndex: number;
}

interface ParallaxPageProps {
  index: number;
  itemWidth: number;
  page: ParallaxCarouselPage;
  parallaxIntensity: number;
  scrollX: SharedValue<number>;
}

function ParallaxPage({ index, itemWidth, page, parallaxIntensity, scrollX }: ParallaxPageProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * itemWidth, index * itemWidth, (index + 1) * itemWidth];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0.42, 1, 0.42], Extrapolation.CLAMP),
      transform: [
        {
          translateX: interpolate(
            scrollX.value,
            inputRange,
            [-itemWidth * parallaxIntensity, 0, itemWidth * parallaxIntensity],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(scrollX.value, inputRange, [0.92, 1, 0.92], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <View style={[styles.page, { width: itemWidth }]}>
      <Animated.View style={[styles.pageContent, animatedStyle]}>{page.content}</Animated.View>
    </View>
  );
}

export function ParallaxCarousel({
  itemWidth,
  onIndexChange,
  pages,
  parallaxIntensity = 0.16,
  selectedIndex,
}: ParallaxCarouselProps) {
  const scrollX = useSharedValue(0);
  const listRef = useRef<FlatList<ParallaxCarouselPage>>(null);
  const selectedIndexRef = useRef(selectedIndex);
  const onIndexChangeRef = useRef(onIndexChange);

  selectedIndexRef.current = selectedIndex;
  onIndexChangeRef.current = onIndexChange;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<ParallaxCarouselPage>[] }) => {
      const visible = viewableItems.find((item) => item.isViewable && item.index !== null);
      if (visible?.index !== null && visible?.index !== undefined) {
        onIndexChangeRef.current(visible.index);
      }
    },
  ).current;

  useEffect(() => {
    listRef.current?.scrollToOffset({
      animated: true,
      offset: selectedIndex * itemWidth,
    });
  }, [itemWidth, selectedIndex]);

  return (
    <View style={styles.wrapper}>
      <Animated.FlatList
        ref={listRef}
        data={[...pages]}
        decelerationRate="fast"
        horizontal
        keyExtractor={(page) => page.id}
        onScroll={onScroll}
        onViewableItemsChanged={onViewableItemsChanged}
        pagingEnabled
        renderItem={({ item, index }) => (
          <ParallaxPage
            index={index}
            itemWidth={itemWidth}
            page={item}
            parallaxIntensity={parallaxIntensity}
            scrollX={scrollX}
          />
        )}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={styles.list}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, overflow: 'hidden' },
  list: { flex: 1 },
  page: { flex: 1, overflow: 'hidden' },
  pageContent: { flex: 1 },
});
