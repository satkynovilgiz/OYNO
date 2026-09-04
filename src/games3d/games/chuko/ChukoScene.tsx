import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import * as THREE from 'three';

import { TacticalCamera } from '../../camera/TacticalCamera';
import { DragAimIndicator } from '../../controls/DragAimIndicator';
import { scenePalette } from '../../shared/scenePalette';
import { ChukoField } from './ChukoField';
import { getLaunchPosition, type ChukoPhysicsWorld } from './ChukoPhysicsWorld';
import { ChukoPiece } from './ChukoPiece';
import type { ChukoPhase } from './ChukoTypes';

const PIECE_Y = 0.045;
// Close and low (Section "CHUKO — CAMERA": "close, low, slightly angled"),
// unlike Ordo's higher tactical overview - same TacticalCamera rig, a
// different offset is what actually changes the feel per game.
const CAMERA_CENTER = new THREE.Vector3(0, 0, 0);
const CAMERA_OVERVIEW_OFFSET = new THREE.Vector3(0, 2.4, 2.6);

type ChukoSceneProps = {
  phase: ChukoPhase;
  world: ChukoPhysicsWorld;
  onSettled: () => void;
  pullX: SharedValue<number>;
  pullY: SharedValue<number>;
  isPulling: SharedValue<boolean>;
};

export function ChukoScene({ phase, world, onSettled, pullX, pullY, isPulling }: ChukoSceneProps) {
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

      <ChukoField />

      {world.pieces.map((piece) => (
        <ChukoPiece
          key={piece.id}
          ref={(node) => {
            if (node) pieceRefs.current.set(piece.id, node);
            else pieceRefs.current.delete(piece.id);
          }}
        />
      ))}

      <ChukoPiece isStriker ref={strikerRef} />

      <DragAimIndicator pullX={pullX} pullY={pullY} isPulling={isPulling} getLaunchPosition={getLaunchPosition} color={scenePalette.gold} maxLength={1.1} />
    </>
  );
}
