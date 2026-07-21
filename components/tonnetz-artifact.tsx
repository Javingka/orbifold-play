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
  notePoints: readonly [Point, Point, Point];
  notePitchClasses: readonly [number, number, number];
  cellSize: number;
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

function moveToward(point: Point, target: Point, amount: number): Point {
  return {
    x: point.x + (target.x - point.x) * amount,
    y: point.y + (target.y - point.y) * amount,
  };
}

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
      const notePoints: readonly [Point, Point, Point] = [
        moveToward(points[0], center, 0.38),
        moveToward(points[1], center, 0.38),
        moveToward(points[2], center, 0.38),
      ];
      const [root, third, fifth] = face.pitchClasses;
      const notePitchClasses: readonly [number, number, number] = isMajor
        ? [third, fifth, root]
        : [root, fifth, third];
      const hitStyle: ViewStyle & { clipPath: string } = {
        left,
        top,
        width: cell,
        height: rowHeight,
        clipPath: isMajor
          ? 'polygon(50% 0%, 100% 100%, 0% 100%)'
          : 'polygon(0% 0%, 100% 0%, 50% 100%)',
      };
      renderFaces.push({
        face,
        points,
        center,
        notePoints,
        notePitchClasses,
        cellSize: cell,
        hitStyle,
        path,
      });
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
        {renderFaces.map(({ center, cellSize, face, notePitchClasses, notePoints }) => {
          const selected = face.id === selectedId;
          const { base, inScale } = resolveFaceAppearance(face, scaleRootPc, scaleMode);
          const noteSize = Math.max(15, Math.min(19, cellSize * 0.2));
          const chordFontSize = Math.max(14, Math.min(19, cellSize * 0.2));
          const chordLineHeight = chordFontSize * 1.08;

          return (
            <View key={`${face.id}:labels`} style={StyleSheet.absoluteFill}>
              <Text
                numberOfLines={1}
                style={[
                  styles.chordLabel,
                  {
                    color: selected ? '#fff4dc' : base,
                    fontSize: chordFontSize,
                    lineHeight: chordLineHeight,
                    left: center.x - cellSize * 0.31,
                    opacity: selected ? 1 : inScale ? 0.96 : 0.58,
                    top: center.y - chordLineHeight / 2,
                    width: cellSize * 0.62,
                  },
                ]}
              >
                {chordLabel(face)}
              </Text>
              {selected || inScale
                ? notePoints.map((point, noteIndex) => (
                    <View
                      key={`${face.id}:note:${noteIndex}`}
                      style={[
                        styles.noteBadge,
                        {
                          borderRadius: noteSize / 2,
                          height: noteSize,
                          left: point.x - noteSize / 2,
                          opacity: selected ? 1 : 0.94,
                          top: point.y - noteSize / 2,
                          width: noteSize,
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.noteLabel,
                          {
                            fontSize: noteSize * 0.49,
                            lineHeight: noteSize,
                          },
                        ]}
                      >
                        {NOTE_NAMES[notePitchClasses[noteIndex] as number]}
                      </Text>
                    </View>
                  ))
                : null}
            </View>
          );
        })}
      </View>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {renderFaces.map(({ face, hitStyle }) => (
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
