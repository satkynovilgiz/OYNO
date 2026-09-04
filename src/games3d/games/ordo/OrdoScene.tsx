import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import * as THREE from 'three';

import { TacticalCamera } from '../../camera/TacticalCamera';
import { DragAimIndicator } from '../../controls/DragAimIndicator';
import { scenePalette } from '../../shared/scenePalette';
import { OrdoField } from './OrdoField';
import { getLaunchPosition, type OrdoPhysicsWorld } from './OrdoPhysicsWorld';
import { OrdoPiece } from './OrdoPiece';
import type { OrdoPhase } from './OrdoTypes';

const PIECE_Y = 0.08;
const CAMERA_CENTER = new THREE.Vector3(0, 0, 0);
const CAMERA_OVERVIEW_OFFSET = new THREE.Vector3(0, 7.5, 6.5);

type OrdoSceneProps = {
  phase: OrdoPhase;
  world: OrdoPhysicsWorld;
  onSettled: () => void;
  pullX: SharedValue<number>;
  pullY: SharedValue<number>;
  isPulling: SharedValue<boolean>;
};

export function OrdoScene({ phase, world, onSettled, pullX, pullY, isPulling }: OrdoSceneProps) {
  const pieceRefs = useRef(new Map<string, THREE.Group>());
  const strikerRef = useRef<THREE.Group>(null);
  const settledCalledRef = useRef(false);
  const followPointRef = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (phase === 'SETTLING') settledCalledRef.current = false;
  }, [phase]);

  useFrame((_state, delta) => {
    if (phase === 'SETTLING') {
      world.step(delta);
      if (!settledCalledRef.current && world.isSettled()) {
        settledCalledRef.current = true;
        onSettled();
      }
    }

    for (const piece of world.pieces) {
      const meshRef = pieceRefs.current.get(piece.id);
      if (meshRef) {
        meshRef.position.set(piece.x, PIECE_Y, piece.z);
        meshRef.rotation.y = piece.rotation;
      }
    }

    if (world.striker && strikerRef.current) {
      strikerRef.current.visible = true;
      strikerRef.current.position.set(world.striker.x, PIECE_Y, world.striker.z);
      strikerRef.current.rotation.y = world.striker.rotation;
      if (!followPointRef.current) followPointRef.current = new THREE.Vector3();
      followPointRef.current.set(world.striker.x, 0, world.striker.z);
    } else {
      if (strikerRef.current) strikerRef.current.visible = false;
      followPointRef.current = null;
    }
  });

  return (
    <>
      <TacticalCamera center={CAMERA_CENTER} overviewOffset={CAMERA_OVERVIEW_OFFSET} followPointRef={followPointRef} />

      <OrdoField />

      {world.pieces.map((piece) => (
        <OrdoPiece
          key={piece.id}
          kind={piece.kind}
          ref={(node) => {
            if (node) pieceRefs.current.set(piece.id, node);
            else pieceRefs.current.delete(piece.id);
          }}
        />
      ))}

      <OrdoPiece kind="regular" isStriker ref={strikerRef} />

      <DragAimIndicator pullX={pullX} pullY={pullY} isPulling={isPulling} getLaunchPosition={getLaunchPosition} color={scenePalette.gold} />
    </>
  );
}
