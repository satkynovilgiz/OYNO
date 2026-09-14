# 3D game assets

Tracks every asset (model, texture, sound) used by `src/games3d`, its source,
and its license, per the "no unlicensed models" rule for the 3D games phase.

## Current status: two real GLB models in use (Jaa Atuu, Kyz Kuumai only)

Everything else across all 5 games is still Three.js primitive geometry
(`boxGeometry`, `coneGeometry`, `cylinderGeometry`, `circleGeometry`,
`torusGeometry`, `capsuleGeometry`, `sphereGeometry`) and flat/vertex
colors defined in `src/games3d/shared/scenePalette.ts` - no textures.

| Object | File | Geometry | Status |
|---|---|---|---|
| Sky | `shared/environment/KyrgyzSky.tsx` | Inverted sphere, vertex-color gradient | PLACEHOLDER |
| Mountains | `shared/environment/MountainBackdrop.tsx` | Cones (4-sided, flat-shaded) | PLACEHOLDER |
| Ground | `shared/environment/JailooTerrain.tsx` | Flat plane | PLACEHOLDER |
| Boz-uy | `shared/environment/BozUy.tsx` | Cylinder + cone | PLACEHOLDER |
| Archer (Jaa Atuu) | GLB via `CharacterLoader` (see Model log) - `CharacterModel.tsx` is the fallback | Real rigged/animated mesh | PRODUCTION_CANDIDATE |
| Horse + rider (Kyz Kuumai) | GLB via `HorseLoader` (see Model log) for the horse; rider stays procedural (`GenericRider` in `HorseLoader.tsx`) | Real rigged/animated horse mesh + procedural rider | PRODUCTION_CANDIDATE (horse) / STYLIZED_PROTOTYPE (rider) |
| Horse + rider (Kok Boru) | `shared/horse/HorseModel.tsx` | Boxes/cylinders/capsule, procedural gait bob | STYLIZED_PROTOTYPE (not touched this pass - see docs/3D_GAMES.md) |
| Target | `games/jaa-atuu/JaaAtuuTarget.tsx` | Stacked circles + boxes (stand) | STYLIZED_PROTOTYPE |
| Arrow | `games/jaa-atuu/JaaAtuuArrow.tsx` | Cylinder + cones + fletching fins | STYLIZED_PROTOTYPE |
| Bow | `games/jaa-atuu/JaaAtuuBow.tsx` | Riser + tapered limbs + dynamic 2-segment string | STYLIZED_PROTOTYPE |
| Ordo khan/piece | `games/ordo/OrdoPiece.tsx` | Cylinder disc, khan visually distinct (gold/metal) | PLACEHOLDER |
| Chuko piece | `games/chuko/ChukoPiece.tsx` | Offset boxes (approximating an astragalus) | PLACEHOLDER |
| Kok Boru object (ulak) | `games/kok-boru/KokBoruObject.tsx` | Sphere + torus band - deliberately abstract, not literal | PLACEHOLDER |

Status vocabulary: `PLACEHOLDER` (stand-in, not meant to resemble the real
thing) < `STYLIZED_PROTOTYPE` (deliberate simplified art direction) <
`PRODUCTION_CANDIDATE` (a real, licensed, reasonably fitting asset, not yet
verified on a real device or visually reviewed by a human) <
`PRODUCTION_READY` (verified on-device and signed off). Nothing in this repo
is `PRODUCTION_READY` yet - the two GLBs below are `PRODUCTION_CANDIDATE`
specifically because they have not been seen rendered (no working visual
preview was available in the environment that integrated them - see
docs/3D_GAMES.md's device-testing note).

## GLB/GLTF loading pipeline (built and now exercised by 2 real models)

`metro.config.js` (project root) adds `glb`/`gltf`/`bin` to Metro's
`resolver.assetExts`, so a bundled `.glb` resolves like any other asset.

`shared/characters/CharacterLoader.tsx` and `shared/horse/HorseLoader.tsx`
are drop-in replacements for `CharacterModel`/`HorseModel` with an identical
ref/prop contract - existing scenes don't change when a model is added,
except swapping the import (Jaa Atuu's `JaaAtuuScene.tsx` and Kyz Kuumai's
`KyzKuumaiScene.tsx` both do this now). Both load via `@react-three/drei`'s
`useGLTF`/`useAnimations` (resolved through `expo-asset`), crossfade clips
through `shared/animation/useClipCrossfade.ts` using the shared
`AnimationStateId` vocabulary (`Idle`/`Walk`/`Run`/`Gallop`/`Aim`/`Shoot`/
`Ride`), and fall back to the procedural model both when a `modelId` has no
manifest entry *and* when the GLB fails to load at runtime
(`shared/assets/ModelErrorBoundary.tsx` - a real error boundary, not just
the no-entry case).

A manifest entry also carries `scale`/`groundOffsetY` (a real exported rig
essentially never lands on this app's "1 unit ~= 1 meter" scale or exactly
plants its feet at y=0 by default - both were measured per-model from the
GLB's own bone hierarchy, not eyeballed) and, for horses, `riderAnchor` (the
saddle position) and `accessories` (character-only: procedural kalpak/quiver
attached to resolved bones, sized for that model's own baked armature
scale - see `CharacterLoader.tsx`'s `buildAccessory`).

**To add another real model:** store the file under `assets/models/<name>.glb`,
add an entry to `characterModelManifest`/`horseModelManifest` in
`shared/assets/modelManifest.ts` (see `quaterniusHuman`/`quaterniusHorse`
below as worked examples, including how `scale`/`groundOffsetY` were
derived), set `modelId` on the relevant `CharacterVariant` or pass it to
`HorseLoader`, and record it in the Model log below with source + license
**before merging** - required, not optional.

**Not verified on-device or visually reviewed**: `tsc`/tests pass and Metro
resolves both GLBs cleanly (checked by starting the dev server after adding
them), but no human or on-device look has confirmed final visual fit
(kalpak/quiver sizing on the archer, saddle position on the horse) - see
docs/3D_GAMES.md.

## Model log

| File | Source | License | Author | Modifications | Used in |
|---|---|---|---|---|---|
| `assets/models/quaternius-animated-human.glb` | https://poly.pizza/m/c3Ibh9I3udk (mirrors quaternius.com) | CC0 1.0 Universal (Public Domain) - no attribution required | Quaternius | None - used as downloaded | Jaa Atuu archer (`CharacterTypes.ts` `playerArcher.modelId`) |
| `assets/models/quaternius-horse.glb` | https://poly.pizza/m/qvTrSG9pZF (mirrors quaternius.com) | CC0 1.0 Universal (Public Domain) - no attribution required | Quaternius | None - used as downloaded | Kyz Kuumai player + AI horse (`KyzKuumaiScene.tsx`, `modelId: 'quaterniusHorse'`) |

Both are untextured (flat PBR `baseColorFactor` materials, no
`baseColorTexture`/images at all) - zero texture-memory cost, well under
this doc's texture-size guidance by construction. Triangle counts: archer
~1,578; horse ~2,182 - both comfortably mobile-friendly. File sizes: archer
682 KB, horse 1,082 KB (no textures to bloat either).

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
