// SPDX-License-Identifier: AGPL-3.0-only
import { Canvas, Group, Path, Rect, Skia, SweepGradient, vec } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, type ViewStyle, View } from 'react-native';

import {
  createFiniteTonnetz,
  type FiniteTonnetzFace,
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
  hitStyle: ViewStyle & { clipPath: string };
  path: ReturnType<typeof Skia.Path.Make>;
}

interface TonnetzArtifactProps {
  selectedId: string | null;
  scaleMode: ScaleMode;
  scaleRootPc: number;
  onSelect: (face: FiniteTonnetzFace) => void;
}

const FACES = createFiniteTonnetz();
const MAJOR_FACES = FACES.filter((face) => face.quality === 'maj').sort(
  (a, b) => a.rootPc - b.rootPc,
);
const MINOR_FACES = FACES.filter((face) => face.quality === 'min').sort(
  (a, b) => a.rootPc - b.rootPc,
);
const HEX_ROWS = [
  { count: 5, startsMajor: true },
  { count: 7, startsMajor: true },
  { count: 7, startsMajor: false },
  { count: 5, startsMajor: false },
] as const;
const FUNCTION_COLORS: Record<TonalFunction, string> = {
  tonic: '#f3b15a',
  subdominant: '#56cfc4',
  dominant: '#e87bac',
};

function makeRenderFaces(width: number, height: number): readonly RenderFace[] {
  const padding = 12;
  if (width <= padding * 2 || height <= padding * 2) return [];

  const cell = Math.min((width - padding * 2) / 4, (height - padding * 2) / (4 * 0.866));
  const rowHeight = cell * 0.866;
  const shapeWidth = cell * 4;
  const shapeHeight = rowHeight * 4;
  const originX = (width - shapeWidth) / 2;
  const originY = (height - shapeHeight) / 2;
  const renderFaces: RenderFace[] = [];
  let majorIndex = 0;
  let minorIndex = 0;

  HEX_ROWS.forEach((row, rowIndex) => {
    const rowWidth = ((row.count + 1) / 2) * cell;
    const rowX = originX + (shapeWidth - rowWidth) / 2;
    const top = originY + rowIndex * rowHeight;

    for (let column = 0; column < row.count; column += 1) {
      const isMajor = column % 2 === 0 ? row.startsMajor : !row.startsMajor;
      const face = isMajor
        ? (MAJOR_FACES[majorIndex++] as FiniteTonnetzFace)
        : (MINOR_FACES[minorIndex++] as FiniteTonnetzFace);
      const left = rowX + column * cell * 0.5;
      const points: readonly [Point, Point, Point] = isMajor
        ? [
            { x: left + cell * 0.5, y: top },
            { x: left + cell, y: top + rowHeight },
            { x: left, y: top + rowHeight },
          ]
        : [
            { x: left, y: top },
            { x: left + cell, y: top },
            { x: left + cell * 0.5, y: top + rowHeight },
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
      const hitStyle: ViewStyle & { clipPath: string } = {
        left,
        top,
        width: cell,
        height: rowHeight,
        clipPath: isMajor
          ? 'polygon(50% 0%, 100% 100%, 0% 100%)'
          : 'polygon(0% 0%, 100% 0%, 50% 100%)',
      };
      renderFaces.push({ face, points, center, hitStyle, path });
    }
  });

  return renderFaces;
}

export function TonnetzArtifact({
  selectedId,
  scaleMode,
  scaleRootPc,
  onSelect,
}: TonnetzArtifactProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const renderFaces = useMemo(
    () => makeRenderFaces(size.width, size.height),
    [size.height, size.width],
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
          {renderFaces.map(({ face, path }) => {
            const selected = face.id === selectedId;
            const role = resolveDiatonicFaceRole(face, scaleRootPc, scaleMode);
            const inScale = role !== null;
            const base = role
              ? FUNCTION_COLORS[role.tonalFunction]
              : face.quality === 'maj'
                ? '#8aa0ff'
                : '#56cfc4';
            const isTonic = role?.degree === 0;
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
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {renderFaces.map(({ face, hitStyle }) => (
          <Pressable
            key={face.id}
            accessibilityLabel={`Play chord ${face.rootPc} ${face.quality}`}
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
});
