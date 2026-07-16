// SPDX-License-Identifier: AGPL-3.0-only
import { Canvas, Group, Path, Rect, Skia, SweepGradient, vec } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {
  createFiniteTonnetz,
  type FiniteTonnetzFace,
} from '@/packages/music-core/src/finite-tonnetz';

interface Point {
  x: number;
  y: number;
}

interface RenderFace {
  face: FiniteTonnetzFace;
  points: readonly [Point, Point, Point];
  center: Point;
  path: ReturnType<typeof Skia.Path.Make>;
}

interface TonnetzArtifactProps {
  selectedId: string | null;
  onSelect: (face: FiniteTonnetzFace) => void;
}

const FACES = createFiniteTonnetz();

function contains(point: Point, triangle: readonly [Point, Point, Point]): boolean {
  const [a, b, c] = triangle;
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (denominator === 0) return false;

  const u = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator;
  const v = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator;
  return u >= 0 && v >= 0 && u + v <= 1;
}

function makeRenderFaces(width: number, height: number): readonly RenderFace[] {
  const padding = 20;
  const cell = Math.min((width - padding * 2) / 5.5, (height - padding * 2) / (3 * 0.866));
  const rowHeight = cell * 0.866;
  const shapeWidth = cell * 5.5;
  const shapeHeight = rowHeight * 3;
  const originX = (width - shapeWidth) / 2;
  const originY = (height - shapeHeight) / 2 + shapeHeight;

  const position = (i: number, j: number): Point => ({
    x: originX + i * cell + j * cell * 0.5,
    y: originY - j * rowHeight,
  });

  return FACES.map((face) => {
    const { i, j } = face.cell;
    const a = position(i, j);
    const b = position(i + 1, j);
    const c = position(i, j + 1);
    const d = position(i + 1, j + 1);
    const points: readonly [Point, Point, Point] = face.quality === 'maj' ? [a, b, c] : [b, c, d];
    const path = Skia.Path.Make();
    path.moveTo(points[0].x, points[0].y);
    path.lineTo(points[1].x, points[1].y);
    path.lineTo(points[2].x, points[2].y);
    path.close();
    const center = {
      x: (points[0].x + points[1].x + points[2].x) / 3,
      y: (points[0].y + points[1].y + points[2].y) / 3,
    };
    return { face, points, center, path };
  });
}

export function TonnetzArtifact({ selectedId, onSelect }: TonnetzArtifactProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const renderFaces = useMemo(
    () => makeRenderFaces(size.width, size.height),
    [size.height, size.width],
  );

  const handleLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const handlePress = (event: GestureResponderEvent): void => {
    const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
    const exactHit = renderFaces.find((candidate) => contains(point, candidate.points));
    const hit =
      exactHit ??
      renderFaces.reduce<RenderFace | null>((nearest, candidate) => {
        if (!nearest) return candidate;
        const candidateDistance = Math.hypot(
          candidate.center.x - point.x,
          candidate.center.y - point.y,
        );
        const nearestDistance = Math.hypot(nearest.center.x - point.x, nearest.center.y - point.y);
        return candidateDistance < nearestDistance ? candidate : nearest;
      }, null);
    if (hit) onSelect(hit.face);
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
          {renderFaces.map(({ face, path }) => {
            const selected = face.id === selectedId;
            const base = face.quality === 'maj' ? '#8aa0ff' : '#56cfc4';
            return (
              <Group key={face.id}>
                {selected ? (
                  <Path path={path} color="#f7f8ff" style="stroke" strokeWidth={8} opacity={0.2} />
                ) : null}
                <Path
                  path={path}
                  color={selected ? '#f3b15a' : base}
                  opacity={selected ? 0.95 : 0.2}
                />
                <Path
                  path={path}
                  color={selected ? '#ffffff' : '#8791aa'}
                  style="stroke"
                  strokeWidth={selected ? 1.8 : 0.7}
                  opacity={selected ? 0.9 : 0.42}
                />
              </Group>
            );
          })}
        </Group>
      </Canvas>
      <Pressable
        accessibilityLabel="Playable 24 chord Tonnetz"
        onPress={handlePress}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 280,
  },
});
