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

## Sound Effects

All 3D-game SFX are **CC0 (Creative Commons Zero / public domain)** from
three Kenney.nl packs, downloaded directly from kenney.nl and converted
from the packs' `.ogg` originals to `.mp3` (iOS's AVFoundation cannot
decode Ogg Vorbis, so `.ogg` would silently fail to play on iOS while
working fine on Android/web - `.mp3` is supported on all three). Each
pack's own `License.txt` states: *"License: (Creative Commons Zero, CC0) -
This content is free to use in personal, educational and commercial
projects. Support us by crediting Kenney or www.kenney.nl (this is not
mandatory)."* No attribution is legally required; Kenney is credited here
anyway.

- RPG Audio (Kenney, kenney.nl/assets/rpg-audio) - CC0
- Impact Sounds (Kenney, kenney.nl/assets/impact-sounds) - CC0
- Interface Sounds (Kenney, kenney.nl/assets/interface-sounds) - CC0

A few slots are **stylized stand-ins**, not literal recordings of the real
thing - called out explicitly below rather than left to look authentic by
omission. This mirrors the "MOBILE PROTOTYPE ADAPTATION" honesty convention
used elsewhere in this doc for mechanics.

| Game | Slot (event) | File | Source pack / original file | Note |
|---|---|---|---|---|
| Jaa Atuu | draw (bow draw) | `assets/audio/games/jaa-atuu/draw.mp3` | RPG Audio / `drawKnife2.ogg` | Stand-in - no bow-foley recording in the sourced packs |
| Jaa Atuu | release (arrow release) | `assets/audio/games/jaa-atuu/release.mp3` | RPG Audio / `knifeSlice.ogg` | Stand-in |
| Jaa Atuu | impactLight (target hit, low score) | `assets/audio/games/jaa-atuu/impactLight.mp3` | Impact Sounds / `impactSoft_medium_000.ogg` | |
| Jaa Atuu | impactMedium (target hit, ≥50) | `assets/audio/games/jaa-atuu/impactMedium.mp3` | Impact Sounds / `impactWood_medium_000.ogg` | |
| Jaa Atuu | impactHeavy (bullseye) | `assets/audio/games/jaa-atuu/impactHeavy.mp3` | Impact Sounds / `impactWood_heavy_000.ogg` | |
| Jaa Atuu | miss | `assets/audio/games/jaa-atuu/miss.mp3` | Impact Sounds / `impactSoft_medium_001.ogg` | |
| Jaa Atuu | result (round ends) | `assets/audio/games/jaa-atuu/result.mp3` | Interface Sounds / `confirmation_001.ogg` | |
| Ordo | pieceHit | `assets/audio/games/ordo/pieceHit.mp3` | Impact Sounds / `impactWood_light_000.ogg` | |
| Ordo | clear (successful capture/khan) | `assets/audio/games/ordo/clear.mp3` | Interface Sounds / `confirmation_002.ogg` | |
| Ordo | turnChange | `assets/audio/games/ordo/turnChange.mp3` | Interface Sounds / `switch_002.ogg` | |
| Ordo | win | `assets/audio/games/ordo/win.mp3` | Interface Sounds / `confirmation_004.ogg` | |
| Ordo | loss | `assets/audio/games/ordo/loss.mp3` | Interface Sounds / `error_002.ogg` | |
| Ordo | draw | `assets/audio/games/ordo/draw.mp3` | Interface Sounds / `select_001.ogg` | Not explicitly requested - added for completeness since `OrdoResultSummary.winner` already has a `'draw'` case |
| Chuko | throw | `assets/audio/games/chuko/throw.mp3` | RPG Audio / `chop.ogg` | Stand-in |
| Chuko | land (pieces hitting ground) | `assets/audio/games/chuko/land.mp3` | Impact Sounds / `impactWood_medium_001.ogg` | |
| Chuko | success (successful result / win) | `assets/audio/games/chuko/success.mp3` | Interface Sounds / `confirmation_001.ogg` | |
| Chuko | loss | `assets/audio/games/chuko/loss.mp3` | Interface Sounds / `error_002.ogg` | Not explicitly requested - added for parity with Ordo, which Chuko otherwise mirrors exactly (see docs/3D_GAMES.md) |
| Chuko | draw | `assets/audio/games/chuko/draw.mp3` | Interface Sounds / `select_001.ogg` | Same reasoning as loss, above |
| Kyz Kuumai | hoofbeat | `assets/audio/games/kyz-kuumai/hoofbeat.mp3` | Impact Sounds / `footstep_grass_000.ogg` | Stand-in (grass footstep, not a hoof recording); re-triggered on a throttle while moving rather than looped - see docs/3D_GAMES.md |
| Kyz Kuumai | checkpoint | `assets/audio/games/kyz-kuumai/checkpoint.mp3` | Interface Sounds / `select_003.ogg` | |
| Kyz Kuumai | sprint | `assets/audio/games/kyz-kuumai/sprint.mp3` | Interface Sounds / `switch_005.ogg` | |
| Kyz Kuumai | finish | `assets/audio/games/kyz-kuumai/finish.mp3` | Interface Sounds / `confirmation_004.ogg` | |
| Kok Boru | pickup | `assets/audio/games/kok-boru/pickup.mp3` | RPG Audio / `handleSmallLeather.ogg` | |
| Kok Boru | steal | `assets/audio/games/kok-boru/steal.mp3` | Impact Sounds / `impactPunch_medium_000.ogg` | |
| Kok Boru | goalPlayer | `assets/audio/games/kok-boru/goalPlayer.mp3` | Interface Sounds / `confirmation_003.ogg` | |
| Kok Boru | goalAi (opponent goal) | `assets/audio/games/kok-boru/goalAi.mp3` | Interface Sounds / `error_004.ogg` | |
| Kok Boru | whistle (final whistle) | `assets/audio/games/kok-boru/whistle.mp3` | Impact Sounds / `impactBell_heavy_000.ogg` | Stand-in - no referee-whistle recording in the sourced CC0 packs; a bell strike reads as a clear "time's up" signal instead |

**Volume/settings**: every `play()` call site passes a conservative volume
(≤0.8, most 0.4-0.65), on top of a hard 0.85 ceiling inside
`GameAudioManager.play()` itself - see docs/3D_GAMES.md's "Audio and
haptics" section for how mute/settings are respected. No background music
was added (not requested this pass, and no suitable licensed track was
sourced/needed).

**Not verified on a real device**: all 26 files bundle/resolve correctly
through Metro (`expo export --platform web` passes clean) and `ffmpeg`
converted every source `.ogg` to `.mp3` without error, but nobody has
actually listened to any of them in the app - whether a file sounds right
for its event, in-game volume balance, and whether `.mp3` decodes
identically across iOS/Android have not been checked on a real device or
in a running app - see docs/3D_GAMES.md.

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
