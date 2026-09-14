# 3D game assets

Tracks every asset (model, texture, sound) used by `src/games3d`, its source,
and its license, per the "no unlicensed models" rule for the 3D games phase.

## Current status: no GLB/GLTF models yet

Every visual across all 5 games is built from Three.js primitive geometry
(`boxGeometry`, `coneGeometry`, `cylinderGeometry`, `circleGeometry`,
`torusGeometry`, `capsuleGeometry`, `sphereGeometry`) and flat/vertex
colors defined in `src/games3d/shared/scenePalette.ts` - no textures, no
downloaded 3D models. This is placeholder geometry (mandated as acceptable
for prototypes), marked here explicitly per the "mark it clearly" rule.

| Object | File | Geometry | Status |
|---|---|---|---|
| Sky | `shared/environment/KyrgyzSky.tsx` | Inverted sphere, vertex-color gradient | Placeholder |
| Mountains | `shared/environment/MountainBackdrop.tsx` | Cones (4-sided, flat-shaded) | Placeholder |
| Ground | `shared/environment/JailooTerrain.tsx` | Flat plane | Placeholder |
| Boz-uy | `shared/environment/BozUy.tsx` | Cylinder + cone | Placeholder |
| Horse + rider | `shared/horse/HorseModel.tsx` | Boxes/cylinders/capsule, procedural gait bob | Placeholder |
| Target | `games/jaa-atuu/JaaAtuuTarget.tsx` | Stacked circles + boxes (stand) | Placeholder |
| Arrow | `games/jaa-atuu/JaaAtuuArrow.tsx` | Cylinder + cones | Placeholder |
| Bow | `games/jaa-atuu/JaaAtuuBow.tsx` | Torus arc + cylinders (string) | Placeholder |
| Ordo khan/piece | `games/ordo/OrdoPiece.tsx` | Cylinder disc, khan visually distinct (gold/metal) | Placeholder |
| Chuko piece | `games/chuko/ChukoPiece.tsx` | Offset boxes (approximating an astragalus) | Placeholder |
| Kok Boru object (ulak) | `games/kok-boru/KokBoruObject.tsx` | Sphere + torus band - deliberately abstract, not literal | Placeholder |

## GLB/GLTF loading pipeline (built, not yet exercised)

`metro.config.js` (project root) already adds `glb`/`gltf`/`bin` to Metro's
`resolver.assetExts`, so a bundled `.glb` resolves like any other asset -
that no longer needs doing per-model.

`shared/characters/CharacterLoader.tsx` and `shared/horse/HorseLoader.tsx`
are drop-in replacements for `CharacterModel`/`HorseModel` with an identical
ref/prop contract - existing scenes don't change when a model is added,
except swapping the import (Jaa Atuu's `JaaAtuuScene.tsx` already does this,
as the reference integration - see `docs/3D_GAMES.md`). Both load via
`@react-three/drei`'s `useGLTF`/`useAnimations` (resolved through
`expo-asset`), never a hand-rolled `GLTFLoader` + `expo-file-system` read,
and crossfade clips through `shared/animation/useClipCrossfade.ts` using the
shared `AnimationStateId` vocabulary (`Idle`/`Walk`/`Run`/`Gallop`/`Aim`/
`Shoot`/`Ride`) rather than each caller knowing a GLB's raw clip names.

**To add a real model:**

1. Store the file under `assets/models/<name>.glb`.
2. Add an entry to `characterModelManifest`/`horseModelManifest` in
   `shared/assets/modelManifest.ts`: `source: require('../../../../assets/models/<name>.glb')`,
   its `clipNames` (this app's state names -> the GLB's actual clip names),
   optionally `bones` (only if a game poses a joint directly per-frame, e.g.
   Jaa Atuu's bow-draw shoulder rotation - see `CharacterAnimator.ts`), and
   a `license: {source, license, author?}` - **required**, not optional,
   per the "no unlicensed models" rule below.
3. Set `modelId` on the relevant `CharacterVariant` (`CharacterTypes.ts`) or
   pass `modelId` to `HorseLoader` at the call site. Nothing else changes -
   `CharacterLoader`/`HorseLoader` render the procedural model for every
   other `modelId` (including `undefined`), which is every character today.
4. Record it in the Model log table below with source + license.
5. `useGLTF.preload(...)` a repeated model (horse, rider, boz-uy) once
   rather than loading it per scene mount (Section 55) - not yet done
   anywhere since no model exists to preload.

**Not yet exercised end-to-end**: no real `.glb` file has been added or
tested through this pipeline (the manifest ships empty by design - see its
own doc comment). Treat `CharacterLoader`/`HorseLoader`'s GLTF-loading path
as unverified plumbing, not confirmed-working, until a real model runs
through it.

## Model log (fill in as models are added)

| File | Source | License | Author (if required) | Added for |
|---|---|---|---|---|
| _(none yet)_ | | | | |

## Cultural-accuracy note (applies across all 5 games)

`games/RESEARCH_SUMMARY.md` and each game's `games/<name>/RULES.md` already
document what's sourced vs. unverified for the existing 2D-game research
pass (Kok Boru is the exception - no `RULES.md` exists for it, since it
wasn't one of the originally-researched 9 games; see `docs/3D_GAMES.md`'s
Kok Boru section). Where a 3D game's mechanics can't be traced to a sourced
rule, the game's own types/docs say so explicitly as a **MOBILE PROTOTYPE
ADAPTATION** rather than imply traditional accuracy - see each game's
`<Name>Types.ts` header comment (`JaaAtuuTypes.ts`, `OrdoTypes.ts`,
`ChukoTypes.ts`, `KyzKuumaiTypes.ts`, `KokBoruTypes.ts`).

**Kyz Kuumai specifically**: its source (`games/kyzKuumay/RULES.md`)
explicitly flagged that the traditional catch resolution (a kiss) needed an
explicit non-literal design decision before implementation, for an
all-ages app. That decision was made in this pass: the catch has no kiss
animation or literal equivalent gesture at all - see
`KyzKuumaiTypes.ts`.
