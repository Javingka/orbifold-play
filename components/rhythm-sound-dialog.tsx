// SPDX-License-Identifier: AGPL-3.0-only
// Stage-local orbit sound selector, following the scale dialog interaction model.
import { BlurView } from 'expo-blur';
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

import { RhythmSoundCarousel } from '@/components/rhythm-sound-carousel';
import {
  getRhythmSoundOption,
  RHYTHM_SOUND_OPTIONS,
  type RhythmOrbitRole,
  type RhythmSoundId,
} from '@/packages/music-core/src/rhythm-sounds';

export interface RhythmSoundDialogLayer {
  color: string;
  id: string;
  label: string;
  role: RhythmOrbitRole;
  soundId: RhythmSoundId;
}

interface RhythmSoundDialogProps {
  layers: readonly RhythmSoundDialogLayer[];
  onAuditionSound: (layerId: string, soundId: RhythmSoundId) => void;
  onClose: () => void;
  onSelectSound: (layerId: string, soundId: RhythmSoundId) => void;
  visible: boolean;
}

const EXIT_DURATION = 220;
const ORBIT_POSITION: Record<RhythmOrbitRole, string> = {
  pulse: 'OUTER',
  click: 'MIDDLE',
  air: 'INNER',
};

export function RhythmSoundDialog({
  layers,
  onAuditionSound,
  onClose,
  onSelectSound,
  visible,
}: RhythmSoundDialogProps) {
  const [mounted, setMounted] = useState(visible);
  const [selectedLayerId, setSelectedLayerId] = useState(layers[0]?.id ?? '');
  const progress = useSharedValue(visible ? 1 : 0);
  const reduceMotion = useReducedMotion();
  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerId) ?? layers[0],
    [layers, selectedLayerId],
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

  if (!mounted || !selectedLayer) return null;
  const selectedSound = getRhythmSoundOption(selectedLayer.soundId);

  return (
    <View
      accessibilityViewIsModal={visible}
      pointerEvents={visible ? 'auto' : 'none'}
      style={styles.root}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable
          accessibilityLabel="Close rhythm sound menu"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.content, contentStyle]}>
        <BlurView intensity={24} pointerEvents="none" style={StyleSheet.absoluteFill} tint="dark" />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.contentTint]} />
        <View style={styles.dialogHeader}>
          <View>
            <Text style={styles.eyebrow}>ORBIT SOUND</Text>
            <Text style={styles.currentSound}>
              {selectedLayer.label.toUpperCase()} · {selectedSound.title}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Close rhythm sound menu"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>
        </View>

        <View accessibilityRole="tablist" style={styles.orbitTabs}>
          {layers.map((layer) => {
            const active = layer.id === selectedLayer.id;
            const sound = getRhythmSoundOption(layer.soundId);
            return (
              <Pressable
                key={layer.id}
                accessibilityLabel={`Select ${layer.label} ${ORBIT_POSITION[layer.role].toLowerCase()} orbit. Current sound ${sound.title}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedLayerId(layer.id)}
                style={[
                  styles.orbitTab,
                  active && styles.orbitTabActive,
                  active && { borderColor: layer.color },
                ]}
              >
                <View style={[styles.orbitDot, { backgroundColor: layer.color }]} />
                <View>
                  <Text style={[styles.orbitLabel, active && styles.orbitLabelActive]}>
                    {layer.label.toUpperCase()}
                  </Text>
                  <Text style={styles.orbitMeta}>
                    {ORBIT_POSITION[layer.role]} · {sound.title}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <RhythmSoundCarousel
          accentColor={selectedLayer.color}
          onAudition={(soundId) => onAuditionSound(selectedLayer.id, soundId)}
          onSelect={(soundId) => onSelectSound(selectedLayer.id, soundId)}
          options={RHYTHM_SOUND_OPTIONS}
          selectedId={selectedLayer.soundId}
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
  backdrop: { backgroundColor: 'rgba(5, 6, 9, 0.34)' },
  content: {
    width: '100%',
    maxWidth: 430,
    minHeight: 146,
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(5, 6, 9, 0.34)',
    borderColor: 'rgba(86, 207, 196, 0.2)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingTop: 4,
    paddingBottom: 6,
  },
  contentTint: { backgroundColor: 'rgba(8, 13, 17, 0.4)' },
  dialogHeader: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  eyebrow: { color: '#71808D', fontSize: 6, fontWeight: '800', letterSpacing: 1.25 },
  currentSound: {
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
    backgroundColor: 'rgba(20, 27, 31, 0.68)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
  },
  closeGlyph: { color: '#D9DEEA', fontSize: 17, fontWeight: '400', lineHeight: 19 },
  orbitTabs: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingTop: 5,
    paddingBottom: 3,
  },
  orbitTab: {
    flex: 1,
    minWidth: 0,
    height: 39,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(64, 74, 88, 0.36)',
    backgroundColor: 'rgba(14, 19, 25, 0.62)',
  },
  orbitTabActive: { backgroundColor: 'rgba(27, 36, 47, 0.86)' },
  orbitDot: { width: 7, height: 7, borderRadius: 4 },
  orbitLabel: { color: '#84909F', fontSize: 7, fontWeight: '800', letterSpacing: 0.55 },
  orbitLabelActive: { color: '#F7F8FF' },
  orbitMeta: { color: '#566273', fontSize: 5.5, fontWeight: '700', marginTop: 2 },
});
