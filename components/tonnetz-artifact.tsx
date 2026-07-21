// SPDX-License-Identifier: AGPL-3.0-only
import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient,
  Path,
  Rect,
  Skia,
  SweepGradient,
  useClock,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  createFiniteTonnetz,
  type FiniteTonnetzFace,
  type TonnetzVertex,
} from '@/packages/music-core/src/finite-tonnetz';
import type { ScaleMode } from '@/packages/music-core/src/scales';
import {
  resolveFluidTonnetzMaterial,
  resolveFluidTonnetzMotionPolicy,
  resolveFluidTonnetzRings,
  type FluidTonnetzMaterial,
} from '@/packages/ui-core/src/fluid-tonnetz';

interface Point {
  x: number;
  y: number;
}

interface RenderFace {
  face: FiniteTonnetzFace;
  points: readonly [Point, Point, Point];
  center: Point;
  cellSize: number;
  hitStyle: ViewStyle & { clipPath: string };
  canonicalPath: ReturnType<typeof Skia.Path.Make>;
  insetPath: ReturnType<typeof Skia.Path.Make>;
}

interface RenderNode {
  key: string;
  pitchClass: number;
  point: Point;
}

interface RenderGeometry {
  faces: readonly RenderFace[];
  nodes: readonly RenderNode[];
}

interface TonnetzArtifactProps {
  selectedId: string | null;
  scaleMode: ScaleMode;
  scaleRootPc: number;
  onSelect: (face: FiniteTonnetzFace) => void;
}

interface InteractionState {
  faceId: string | null;
  token: number;
}

interface FaceMotionProps {
  distance: number | undefined;
  interactionToken: number;
  labelOpacityTarget: number;
  materialOpacityTarget: number;
  reduceMotion: boolean;
  selected: boolean;
}

interface FluidFaceProps extends FaceMotionProps {
  clock: SharedValue<number>;
  material: FluidTonnetzMaterial;
  renderFace: RenderFace;
}

interface FluidLabelProps extends FaceMotionProps {
  material: FluidTonnetzMaterial;
  renderFace: RenderFace;
}

const FACES = createFiniteTonnetz();
const ROW_HEIGHT_RATIO = Math.sqrt(3) / 2;
const FACE_INSET = 0.1;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2;
const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

function touchDistance(event: GestureResponderEvent): number | null {
  const [first, second] = event.nativeEvent.touches;
  if (!first || !second) return null;
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

function chordLabel(face: FiniteTonnetzFace): string {
  return `${NOTE_NAMES[face.rootPc]}${face.quality === 'min' ? 'm' : ''}`;
}

function vertexKey(vertex: Pick<TonnetzVertex, 'i' | 'j'>): string {
  return `${vertex.i}:${vertex.j}`;
}

function projectVertex(vertex: Pick<TonnetzVertex, 'i' | 'j'>): Point {
  // Horizontal Tonnetz edges remain horizontal: opposite major/minor faces
  // therefore share their base exactly as in the approved compact Diamond.
  return {
    x: vertex.i + vertex.j * 0.5,
    y: -vertex.j * ROW_HEIGHT_RATIO,
  };
}

function makePath(points: readonly Point[]): ReturnType<typeof Skia.Path.Make> {
  const builder = Skia.PathBuilder.Make();
  builder.moveTo((points[0] as Point).x, (points[0] as Point).y);
  for (const point of points.slice(1)) builder.lineTo(point.x, point.y);
  return builder.close().build();
}

function insetTriangle(
  points: readonly [Point, Point, Point],
  center: Point,
): readonly [Point, Point, Point] {
  return points.map((point) => ({
    x: point.x + (center.x - point.x) * FACE_INSET,
    y: point.y + (center.y - point.y) * FACE_INSET,
  })) as unknown as readonly [Point, Point, Point];
}

const PROJECTED_VERTICES = FACES.flatMap((face) => face.vertices.map(projectVertex));
const DIAMOND_BOUNDS = {
  minX: Math.min(...PROJECTED_VERTICES.map((point) => point.x)),
  maxX: Math.max(...PROJECTED_VERTICES.map((point) => point.x)),
  minY: Math.min(...PROJECTED_VERTICES.map((point) => point.y)),
  maxY: Math.max(...PROJECTED_VERTICES.map((point) => point.y)),
};

function makeRenderGeometry(width: number, height: number): RenderGeometry {
  const padding = 12;
  if (width <= padding * 2 || height <= padding * 2) return { faces: [], nodes: [] };

  const diamondWidth = DIAMOND_BOUNDS.maxX - DIAMOND_BOUNDS.minX;
  const diamondHeight = DIAMOND_BOUNDS.maxY - DIAMOND_BOUNDS.minY;
  const cell = Math.min(
    (width - padding * 2) / diamondWidth,
    (height - padding * 2) / diamondHeight,
  );
  const originX = (width - diamondWidth * cell) / 2;
  const originY = (height - diamondHeight * cell) / 2;
  const mapVertex = (vertex: TonnetzVertex): Point => {
    const projected = projectVertex(vertex);
    return {
      x: originX + (projected.x - DIAMOND_BOUNDS.minX) * cell,
      y: originY + (projected.y - DIAMOND_BOUNDS.minY) * cell,
    };
  };
  const renderFaces: RenderFace[] = [];
  const renderNodes = new Map<string, RenderNode>();

  for (const face of FACES) {
    const points: readonly [Point, Point, Point] = [
      mapVertex(face.vertices[0]),
      mapVertex(face.vertices[1]),
      mapVertex(face.vertices[2]),
    ];
    const center = {
      x: (points[0].x + points[1].x + points[2].x) / 3,
      y: (points[0].y + points[1].y + points[2].y) / 3,
    };
    const left = Math.min(...points.map((point) => point.x));
    const right = Math.max(...points.map((point) => point.x));
    const top = Math.min(...points.map((point) => point.y));
    const bottom = Math.max(...points.map((point) => point.y));
    const hitWidth = right - left;
    const hitHeight = bottom - top;
    const clipPath = `polygon(${points
      .map(
        (point) =>
          `${(((point.x - left) / hitWidth) * 100).toFixed(2)}% ${(((point.y - top) / hitHeight) * 100).toFixed(2)}%`,
      )
      .join(', ')})`;

    renderFaces.push({
      face,
      points,
      center,
      cellSize: cell,
      hitStyle: { left, top, width: hitWidth, height: hitHeight, clipPath },
      canonicalPath: makePath(points),
      insetPath: makePath(insetTriangle(points, center)),
    });

    face.vertices.forEach((vertex) => {
      const key = vertexKey(vertex);
      if (renderNodes.has(key)) return;
      renderNodes.set(key, { key, pitchClass: vertex.pitchClass, point: mapVertex(vertex) });
    });
  }

  return { faces: renderFaces, nodes: [...renderNodes.values()] };
}

function useFaceMotion({
  distance,
  interactionToken,
  labelOpacityTarget,
  materialOpacityTarget,
  reduceMotion,
  selected,
}: FaceMotionProps) {
  const motionPolicy = resolveFluidTonnetzMotionPolicy(reduceMotion, selected);
  const motionY = useSharedValue(0);
  const motionScale = useSharedValue(1);
  const energy = useSharedValue(0);
  const materialOpacity = useSharedValue(materialOpacityTarget);
  const labelOpacity = useSharedValue(labelOpacityTarget);

  useEffect(() => {
    materialOpacity.value = reduceMotion
      ? materialOpacityTarget
      : withTiming(materialOpacityTarget, { duration: 240, easing: Easing.out(Easing.cubic) });
    labelOpacity.value = reduceMotion
      ? labelOpacityTarget
      : withTiming(labelOpacityTarget, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [labelOpacity, labelOpacityTarget, materialOpacity, materialOpacityTarget, reduceMotion]);

  useEffect(() => {
    cancelAnimation(motionY);
    cancelAnimation(motionScale);
    cancelAnimation(energy);
    motionY.value = 0;
    motionScale.value = 1;
    energy.value = 0;
    if (!motionPolicy.animateGeometry || interactionToken === 0 || distance === undefined) return;

    if (distance === 0) {
      motionY.value = withSequence(
        withTiming(6, { duration: 90, easing: Easing.out(Easing.cubic) }),
        withTiming(-2.4, { duration: 220, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }),
      );
      motionScale.value = withSequence(
        withTiming(0.94, { duration: 90, easing: Easing.out(Easing.cubic) }),
        withTiming(1.03, { duration: 220, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
      );
      return;
    }

    if (distance === 1) {
      motionY.value = withDelay(
        35,
        withSequence(
          withTiming(-2.8, { duration: 150, easing: Easing.out(Easing.cubic) }),
          withTiming(0.8, { duration: 210, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 330, easing: Easing.out(Easing.cubic) }),
        ),
      );
      motionScale.value = withDelay(
        35,
        withSequence(
          withTiming(1.018, { duration: 150, easing: Easing.out(Easing.cubic) }),
          withTiming(0.994, { duration: 210, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 330, easing: Easing.out(Easing.cubic) }),
        ),
      );
      return;
    }

    if (distance === 2) {
      energy.value = withDelay(
        100,
        withSequence(
          withTiming(0.34, { duration: 160, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) }),
        ),
      );
    }
  }, [distance, energy, interactionToken, motionPolicy.animateGeometry, motionScale, motionY]);

  const transform = useDerivedValue(() => {
    return [
      { translateY: motionPolicy.selectedOffset + motionY.value },
      { scale: motionPolicy.selectedScale * motionScale.value },
    ];
  }, [motionPolicy.selectedOffset, motionPolicy.selectedScale]);

  const labelStyle = useAnimatedStyle(() => {
    return {
      opacity: labelOpacity.value,
      transform: [
        { translateY: motionPolicy.selectedOffset + motionY.value },
        { scale: motionPolicy.selectedScale * motionScale.value },
      ],
    };
  }, [motionPolicy.selectedOffset, motionPolicy.selectedScale]);

  return { energy, labelStyle, materialOpacity, transform };
}

function FluidFace({
  clock,
  distance,
  interactionToken,
  labelOpacityTarget,
  material,
  materialOpacityTarget,
  reduceMotion,
  renderFace,
  selected,
}: FluidFaceProps) {
  const motionPolicy = resolveFluidTonnetzMotionPolicy(reduceMotion, selected);
  const { center, cellSize, insetPath } = renderFace;
  const { energy, materialOpacity, transform } = useFaceMotion({
    distance,
    interactionToken,
    labelOpacityTarget,
    materialOpacityTarget,
    reduceMotion,
    selected,
  });
  const radians = (material.gradientAngle * Math.PI) / 180;
  const gradientRadius = cellSize * 0.58;
  const gradientStart = vec(
    center.x - Math.cos(radians) * gradientRadius,
    center.y - Math.sin(radians) * gradientRadius,
  );
  const gradientEnd = vec(
    center.x + Math.cos(radians) * gradientRadius,
    center.y + Math.sin(radians) * gradientRadius,
  );
  const radiantStart = useDerivedValue(
    () => (motionPolicy.animateRadiance ? ((clock.value % 3200) / 3200) * 360 : 0),
    [motionPolicy.animateRadiance],
  );
  const radiantEnd = useDerivedValue(() => radiantStart.value + 360);
  const radiantOpacity = useDerivedValue(
    () => (motionPolicy.animateRadiance ? 0.68 + Math.sin(clock.value / 620) * 0.14 : 0.84),
    [motionPolicy.animateRadiance],
  );
  const edgeOpacity = selected ? 0.92 : material.inScale ? 0.62 : 0.18;

  return (
    <Group origin={vec(center.x, center.y)} transform={transform}>
      <Path path={insetPath} opacity={materialOpacity}>
        <LinearGradient
          colors={[...material.colors]}
          end={gradientEnd}
          positions={[0, 0.54, 1]}
          start={gradientStart}
        />
      </Path>
      <Path
        color={selected ? material.edgeColor : '#DCE3F4'}
        opacity={edgeOpacity}
        path={insetPath}
        strokeWidth={selected ? 1.8 : material.inScale ? 1.05 : 0.65}
        style="stroke"
      />
      <Path color={material.colors[1]} opacity={energy} path={insetPath} />
      {material.radiant ? (
        <>
          <Path opacity={radiantOpacity} path={insetPath} strokeWidth={8} style="stroke">
            <SweepGradient
              c={vec(center.x, center.y)}
              colors={[
                'rgba(255,255,255,0.02)',
                material.colors[1],
                '#FFFFFF',
                material.colors[2],
                'rgba(255,255,255,0.02)',
              ]}
              end={radiantEnd}
              positions={[0, 0.38, 0.5, 0.62, 1]}
              start={radiantStart}
            />
            <BlurMask blur={5.5} style="normal" />
          </Path>
          <Path path={insetPath} strokeWidth={2.25} style="stroke">
            <SweepGradient
              c={vec(center.x, center.y)}
              colors={[
                material.colors[2],
                material.colors[1],
                '#FFFFFF',
                material.colors[1],
                material.colors[2],
              ]}
              end={radiantEnd}
              positions={[0, 0.38, 0.5, 0.62, 1]}
              start={radiantStart}
            />
          </Path>
        </>
      ) : null}
    </Group>
  );
}

function FluidLabel({
  distance,
  interactionToken,
  labelOpacityTarget,
  materialOpacityTarget,
  material,
  reduceMotion,
  renderFace,
  selected,
}: FluidLabelProps) {
  const { center, cellSize, face } = renderFace;
  const { labelStyle } = useFaceMotion({
    distance,
    interactionToken,
    labelOpacityTarget,
    materialOpacityTarget,
    reduceMotion,
    selected,
  });
  const chordFontSize = Math.max(12, Math.min(18, cellSize * 0.23));
  const chordLineHeight = chordFontSize * 1.08;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.chordLabelFrame,
        {
          height: chordLineHeight,
          left: center.x - cellSize * 0.36,
          top: center.y - chordLineHeight / 2,
          width: cellSize * 0.72,
        },
        labelStyle,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.chordLabel,
          {
            color: selected ? '#FFFDF9' : material.inScale ? '#F7F8FF' : '#CBD3E6',
            fontSize: chordFontSize,
            lineHeight: chordLineHeight,
          },
        ]}
      >
        {chordLabel(face)}
      </Text>
    </Animated.View>
  );
}

export function TonnetzArtifact({
  selectedId,
  scaleMode,
  scaleRootPc,
  onSelect,
}: TonnetzArtifactProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [interaction, setInteraction] = useState<InteractionState>({ faceId: null, token: 0 });
  const pinchOrigin = useRef<{ distance: number; zoom: number } | null>(null);
  const reduceMotion = useReducedMotion();
  const clock = useClock();
  const zoom = useSharedValue(1);
  const renderGeometry = useMemo(
    () => makeRenderGeometry(size.width, size.height),
    [size.height, size.width],
  );
  const selectedVertexKeys = useMemo(
    () =>
      new Set(
        FACES.find((face) => face.id === selectedId)?.vertices.map((vertex) => vertexKey(vertex)) ??
          [],
      ),
    [selectedId],
  );
  const interactionRings = useMemo(
    () =>
      interaction.faceId
        ? resolveFluidTonnetzRings(FACES, interaction.faceId, 2)
        : new Map<string, number>(),
    [interaction.faceId],
  );
  const orderedFaces = useMemo(() => {
    const selectedFace = renderGeometry.faces.find(({ face }) => face.id === selectedId);
    if (!selectedFace) return renderGeometry.faces;
    return [...renderGeometry.faces.filter(({ face }) => face.id !== selectedId), selectedFace];
  }, [renderGeometry.faces, selectedId]);
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));

  const handleLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const handleFacePress = (face: FiniteTonnetzFace): void => {
    setInteraction((current) => ({ faceId: face.id, token: current.token + 1 }));
    onSelect(face);
  };

  const handlePinchStart = (event: GestureResponderEvent): void => {
    const distance = touchDistance(event);
    if (distance === null) return;
    pinchOrigin.current = { distance, zoom: zoom.value };
  };

  const handlePinchMove = (event: GestureResponderEvent): void => {
    const distance = touchDistance(event);
    if (distance === null) return;
    if (pinchOrigin.current === null) {
      pinchOrigin.current = { distance, zoom: zoom.value };
      return;
    }
    const nextZoom = pinchOrigin.current.zoom * (distance / pinchOrigin.current.distance);
    zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  };

  const handlePinchEnd = (): void => {
    pinchOrigin.current = null;
  };

  const setZoom = (nextZoom: number): void => {
    zoom.value = withTiming(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom)), {
      duration: reduceMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
    });
  };

  return (
    <View
      onLayout={handleLayout}
      onMoveShouldSetResponder={(event) => event.nativeEvent.touches.length >= 2}
      onResponderGrant={handlePinchStart}
      onResponderMove={handlePinchMove}
      onResponderRelease={handlePinchEnd}
      onResponderTerminate={handlePinchEnd}
      onStartShouldSetResponder={(event) => event.nativeEvent.touches.length >= 2}
      style={styles.container}
    >
      <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={size.width} height={size.height}>
            <SweepGradient
              c={vec(size.width * 0.52, size.height * 0.48)}
              colors={['#050609', '#0d1421', '#090b12', '#050609']}
            />
          </Rect>
          <Group>
            {renderGeometry.faces.map(({ canonicalPath, face }) => (
              <Path
                key={`${face.id}:topology`}
                color="#6D7690"
                opacity={0.2}
                path={canonicalPath}
                strokeWidth={0.8}
                style="stroke"
              />
            ))}
          </Group>
          <Group>
            {orderedFaces.map((renderFace) => {
              const selected = renderFace.face.id === selectedId;
              const material = resolveFluidTonnetzMaterial(
                renderFace.face,
                scaleRootPc,
                scaleMode,
                selected,
              );
              return (
                <FluidFace
                  key={renderFace.face.id}
                  clock={clock}
                  distance={interactionRings.get(renderFace.face.id)}
                  interactionToken={interaction.token}
                  labelOpacityTarget={material.labelOpacity}
                  material={material}
                  materialOpacityTarget={material.opacity}
                  reduceMotion={reduceMotion}
                  renderFace={renderFace}
                  selected={selected}
                />
              );
            })}
          </Group>
        </Canvas>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {orderedFaces.map((renderFace) => {
            const selected = renderFace.face.id === selectedId;
            const material = resolveFluidTonnetzMaterial(
              renderFace.face,
              scaleRootPc,
              scaleMode,
              selected,
            );
            return (
              <FluidLabel
                key={`${renderFace.face.id}:label`}
                distance={interactionRings.get(renderFace.face.id)}
                interactionToken={interaction.token}
                labelOpacityTarget={material.labelOpacity}
                material={material}
                materialOpacityTarget={material.opacity}
                reduceMotion={reduceMotion}
                renderFace={renderFace}
                selected={selected}
              />
            );
          })}
          {renderGeometry.nodes.map(({ key, pitchClass, point }) => {
            const selected = selectedVertexKeys.has(key);
            const nodeSize = Math.max(
              15,
              Math.min(20, (renderGeometry.faces[0]?.cellSize ?? 0) * 0.28),
            );
            return (
              <View
                key={key}
                style={[
                  styles.noteBadge,
                  {
                    borderColor: selected ? '#FFD166' : 'rgba(255, 255, 255, 0.82)',
                    borderRadius: nodeSize / 2,
                    borderWidth: selected ? 2 : 1,
                    height: nodeSize,
                    left: point.x - nodeSize / 2,
                    opacity: selected ? 1 : 0.94,
                    top: point.y - nodeSize / 2,
                    width: nodeSize,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.noteLabel, { fontSize: nodeSize * 0.48, lineHeight: nodeSize }]}
                >
                  {NOTE_NAMES[pitchClass]}
                </Text>
              </View>
            );
          })}
        </View>
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {renderGeometry.faces.map(({ face, hitStyle }) => (
            <Pressable
              key={face.id}
              accessibilityLabel={`Play chord ${chordLabel(face)}, notes ${face.pitchClasses
                .map((pitchClass) => NOTE_NAMES[pitchClass])
                .join(', ')}`}
              accessibilityRole="button"
              onPress={() => handleFacePress(face)}
              style={[styles.faceTarget, hitStyle]}
            />
          ))}
        </View>
      </Animated.View>
      <View accessibilityRole="toolbar" style={styles.zoomControls}>
        <Pressable
          accessibilityLabel="Zoom out Tonnetz"
          accessibilityRole="button"
          onPress={() => setZoom(zoom.value - 0.25)}
          style={styles.zoomButton}
        >
          <Text style={styles.zoomGlyph}>−</Text>
        </Pressable>
        <Pressable
          accessibilityHint="Return the Diamond Tonnetz to its original size"
          accessibilityLabel="Reset Tonnetz zoom"
          accessibilityRole="button"
          onPress={() => setZoom(1)}
          style={[styles.zoomButton, styles.zoomResetButton]}
        >
          <Text style={styles.zoomResetText}>1×</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Zoom in Tonnetz"
          accessibilityRole="button"
          onPress={() => setZoom(zoom.value + 0.25)}
          style={styles.zoomButton}
        >
          <Text style={styles.zoomGlyph}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#050609',
    flex: 1,
    minHeight: 150,
    overflow: 'hidden',
  },
  faceTarget: {
    position: 'absolute',
  },
  chordLabelFrame: {
    position: 'absolute',
  },
  chordLabel: {
    fontWeight: '800',
    letterSpacing: -0.35,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.88)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  noteBadge: {
    alignItems: 'center',
    backgroundColor: '#f7f8fb',
    borderColor: 'rgba(255, 255, 255, 0.82)',
    borderWidth: 1,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.48,
    shadowRadius: 3,
  },
  noteLabel: {
    color: '#22242a',
    fontWeight: '800',
    letterSpacing: -0.45,
    textAlign: 'center',
  },
  zoomControls: {
    alignItems: 'center',
    backgroundColor: 'rgba(13, 17, 27, 0.78)',
    borderColor: 'rgba(138, 160, 255, 0.32)',
    borderRadius: 15,
    borderWidth: 1,
    bottom: 8,
    flexDirection: 'row',
    height: 30,
    overflow: 'hidden',
    position: 'absolute',
    right: 8,
  },
  zoomButton: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  zoomResetButton: {
    borderColor: 'rgba(138, 160, 255, 0.2)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    width: 34,
  },
  zoomGlyph: {
    color: '#F7F8FF',
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 20,
  },
  zoomResetText: {
    color: '#8AA0FF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
