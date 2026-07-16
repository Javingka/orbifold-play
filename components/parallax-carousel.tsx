// SPDX-License-Identifier: AGPL-3.0-only
// Adapted from ReactICX Parallax Carousel for arbitrary interactive instrument pages.
import React, { useEffect, useRef } from 'react';
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
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
  const onIndexChangeRef = useRef(onIndexChange);
  const visibleIndexRef = useRef(selectedIndex);
  const itemWidthRef = useRef(itemWidth);

  onIndexChangeRef.current = onIndexChange;

  const reportIndex = (nextIndex: number): void => {
    if (visibleIndexRef.current === nextIndex) return;
    visibleIndexRef.current = nextIndex;
    onIndexChangeRef.current(nextIndex);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const offset = event.nativeEvent.contentOffset.x;
    scrollX.value = offset;
    reportIndex(Math.max(0, Math.min(pages.length - 1, Math.round(offset / itemWidth))));
  };

  const commitVisiblePage = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const nextIndex = Math.max(
      0,
      Math.min(pages.length - 1, Math.round(event.nativeEvent.contentOffset.x / itemWidth)),
    );
    reportIndex(nextIndex);
  };

  useEffect(() => {
    const widthChanged = itemWidthRef.current !== itemWidth;
    itemWidthRef.current = itemWidth;
    if (visibleIndexRef.current === selectedIndex && !widthChanged) return;
    visibleIndexRef.current = selectedIndex;
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
        onMomentumScrollEnd={commitVisiblePage}
        onScroll={onScroll}
        onScrollEndDrag={commitVisiblePage}
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
