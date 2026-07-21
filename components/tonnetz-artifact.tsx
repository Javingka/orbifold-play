// SPDX-License-Identifier: AGPL-3.0-only
import { Canvas, Group, Path, Rect, Skia, SweepGradient, vec } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
  View,
} from 'react-native';

import {
  createFiniteTonnetz,
  type FiniteTonnetzFace,
  type TonnetzVertex,
} from '@/packages/music-core/src/finite-tonnetz';
import {
  resolveDiatonicFaceRole,
  type ScaleMode,
  type TonalFunction,
} from '@/packages/music-core/src/scales';

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
  path: ReturnType<typeof Skia.Path.Make>;
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

const FACES = createFiniteTonnetz();
const ROW_HEIGHT_RATIO = Math.sqrt(3) / 2;
const FUNCTION_COLORS: Record<TonalFunction, string> = {
  tonic: '#f3b15a',
  subdominant: '#56cfc4',
  dominant: '#e87bac',
};
const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

interface FaceAppearance {
  base: string;
  inScale: boolean;
  isTonic: boolean;
}

function resolveFaceAppearance(
  face: FiniteTonnetzFace,
  scaleRootPc: number,
  scaleMode: ScaleMode,
): FaceAppearance {
  const role = resolveDiatonicFaceRole(face, scaleRootPc, scaleMode);
  return {
    base: role
      ? FUNCTION_COLORS[role.tonalFunction]
      : face.quality === 'maj'
        ? '#8aa0ff'
        : '#56cfc4',
    inScale: role !== null,
    isTonic: role?.degree === 0,
  };
}

function chordLabel(face: FiniteTonnetzFace): string {
  return `${NOTE_NAMES[face.rootPc]}${face.quality === 'min' ? 'm' : ''}`;
}

function vertexKey(vertex: Pick<TonnetzVertex, 'i' | 'j'>): string {
  return `${vertex.i}:${vertex.j}`;
}

function projectVertex(vertex: Pick<TonnetzVertex, 'i' | 'j'>): Point {
  // The 60° lattice rotation keeps equilateral faces pointing up/down while
  // giving the Diamond a wider, more legible footprint on a short phone stage.
  return {
    x: vertex.i * 0.5 + vertex.j,
    y: vertex.i * ROW_HEIGHT_RATIO,
  };
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
    const path = Skia.Path.Make();
    path.moveTo(points[0].x, points[0].y);
    path.lineTo(points[1].x, points[1].y);
    path.lineTo(points[2].x, points[2].y);
    path.close();
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
      path,
    });

    face.vertices.forEach((vertex) => {
      const key = vertexKey(vertex);
      if (renderNodes.has(key)) return;
      renderNodes.set(key, { key, pitchClass: vertex.pitchClass, point: mapVertex(vertex) });
    });
  }

  return { faces: renderFaces, nodes: [...renderNodes.values()] };
}

export function TonnetzArtifact({
  selectedId,
  scaleMode,
  scaleRootPc,
  onSelect,
}: TonnetzArtifactProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
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

  const handleLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={size.width} height={size.height}>
          <SweepGradient
            c={vec(size.width * 0.52, size.height * 0.48)}
            colors={['#050609', '#0d1421', '#090b12', '#050609']}
          />
        </Rect>
        <Group>
          {renderGeometry.faces.map(({ face, path }) => {
            const selected = face.id === selectedId;
            const { base, inScale, isTonic } = resolveFaceAppearance(face, scaleRootPc, scaleMode);
            return (
              <Group key={face.id}>
                {selected || isTonic ? (
                  <Path path={path} color="#f7f8ff" style="stroke" strokeWidth={8} opacity={0.2} />
                ) : null}
                <Path
                  path={path}
                  color={selected ? '#f3b15a' : base}
                  opacity={selected ? 0.95 : inScale ? (isTonic ? 0.52 : 0.3) : 0.055}
                />
                <Path
                  path={path}
                  color={selected ? '#ffffff' : inScale ? base : '#586071'}
                  style="stroke"
                  strokeWidth={selected ? 1.8 : inScale ? 1.15 : 0.65}
                  opacity={selected ? 0.9 : inScale ? 0.78 : 0.28}
                />
              </Group>
            );
          })}
        </Group>
      </Canvas>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {renderGeometry.faces.map(({ center, cellSize, face }) => {
          const selected = face.id === selectedId;
          const { base, inScale } = resolveFaceAppearance(face, scaleRootPc, scaleMode);
          const chordFontSize = Math.max(12, Math.min(18, cellSize * 0.23));
          const chordLineHeight = chordFontSize * 1.08;

          return (
            <Text
              key={`${face.id}:label`}
              numberOfLines={1}
              style={[
                styles.chordLabel,
                {
                  color: selected ? '#fff4dc' : base,
                  fontSize: chordFontSize,
                  lineHeight: chordLineHeight,
                  left: center.x - cellSize * 0.36,
                  opacity: selected ? 1 : inScale ? 0.96 : 0.58,
                  top: center.y - chordLineHeight / 2,
                  width: cellSize * 0.72,
                },
              ]}
            >
              {chordLabel(face)}
            </Text>
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
                  borderColor: selected ? '#f3b15a' : 'rgba(255, 255, 255, 0.82)',
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
            onPress={() => onSelect(face)}
            style={[styles.faceTarget, hitStyle]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 150,
  },
  faceTarget: {
    position: 'absolute',
  },
  chordLabel: {
    fontWeight: '800',
    letterSpacing: -0.35,
    position: 'absolute',
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
});
