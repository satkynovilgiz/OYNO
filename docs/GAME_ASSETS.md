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

## When real GLB/GLTF models are added

1. Store the file under `assets/models/<name>.glb`.
2. Record it in the table below with source + license before merging.
3. Add `glb`/`gltf`/`bin` to Metro's `resolver.assetExts` in a
   `metro.config.js` (none exists yet - the project uses Expo's default
   Metro config, which does not include these extensions).
4. Load it with `@react-three/drei`'s `useGLTF` (native-compatible, resolves
   through `expo-asset`/`expo-file-system`, both already installed) rather
   than hand-rolling a `GLTFLoader` + `expo-file-system` read.
5. Preload/cache repeated models (horse, rider, boz-uy) with `useGLTF.preload`
   instead of loading the same file per scene mount (Section 55).

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
