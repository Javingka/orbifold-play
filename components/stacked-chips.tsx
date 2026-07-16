// SPDX-License-Identifier: MIT
// Adapted from ReactICX Stacked Chips by rit3zh (2026).
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Children, createContext, type ReactNode, useContext, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface ChipContextValue {
  isOpen: boolean;
  toggle: () => void;
  triggerWidth: number;
  depth: number;
  parentIsOpen: boolean;
  setTriggerWidth: (width: number) => void;
}

interface ChildrenProps {
  children: ReactNode;
}

interface TriggerProps extends ChildrenProps {
  onPress?: () => void;
}

const ChipContext = createContext<ChipContextValue | null>(null);

function Root({ children }: ChildrenProps) {
  const parent = useContext(ChipContext);
  const [isOpen, setIsOpen] = useState(false);
  const [triggerWidth, setTriggerWidth] = useState(0);
  const depth = parent ? parent.depth + 1 : 0;

  return (
    <ChipContext.Provider
      value={{
        isOpen,
        toggle: () => setIsOpen((value) => !value),
        triggerWidth,
        depth,
        parentIsOpen: parent?.isOpen ?? false,
        setTriggerWidth,
      }}
    >
      <View style={[styles.container, { zIndex: 100 - depth }]}>{children}</View>
    </ChipContext.Provider>
  );
}

function Trigger({ children, onPress }: TriggerProps) {
  const context = useContext(ChipContext);
  if (!context) throw new Error('StackedChips.Trigger must be inside StackedChips');

  const { toggle, setTriggerWidth, depth, parentIsOpen } = context;
  const handleLayout = (event: LayoutChangeEvent): void => {
    setTriggerWidth(event.nativeEvent.layout.width);
  };

  const handlePress = (): void => {
    toggle();
    onPress?.();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  };

  return (
    <Pressable onPress={handlePress} onLayout={handleLayout} style={{ zIndex: 100 - depth }}>
      <View>
        {children}
        {depth > 0 ? (
          <BlurView
            pointerEvents="none"
            intensity={parentIsOpen ? 6 : 0}
            style={[StyleSheet.absoluteFill, styles.blur]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function Content({ children }: ChildrenProps) {
  const context = useContext(ChipContext);
  if (!context) throw new Error('StackedChips.Content must be inside StackedChips');

  const { isOpen, triggerWidth, depth } = context;
  const [contentWidth, setContentWidth] = useState(0);
  const animatedStyle = useAnimatedStyle<Partial<ViewStyle>>(
    () => ({
      transform: [{ translateX: withSpring(isOpen ? 0 : -contentWidth + 52) }],
      opacity: withSpring(isOpen ? 1 : 0),
      marginLeft: withSpring(isOpen ? -42 : 0),
    }),
    [contentWidth, isOpen],
  );
  const handleLayout = (event: LayoutChangeEvent): void => {
    setContentWidth(event.nativeEvent.layout.width);
  };

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[styles.content, { left: triggerWidth, zIndex: 99 - depth }, animatedStyle]}
      pointerEvents={isOpen ? 'auto' : 'none'}
    >
      {Children.only(children)}
      <BlurView
        pointerEvents="none"
        intensity={isOpen ? 6 : 0}
        style={[StyleSheet.absoluteFill, styles.blur]}
      />
    </Animated.View>
  );
}

export const StackedChips = Object.assign(Root, { Trigger, Content });

const styles = StyleSheet.create({
  container: { flexDirection: 'row' },
  content: { position: 'absolute' },
  blur: { overflow: 'hidden', borderRadius: 999 },
});
