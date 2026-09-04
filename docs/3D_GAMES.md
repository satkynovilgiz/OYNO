# OYNO 3D games

Proof-of-concept 3D games built directly inside the existing Expo/React
Native app - no Unity, Godot, Unreal, or any separate game-engine editor.
Everything here is TypeScript/TSX, developed and run through the normal
`npm start` / Expo tooling.

## Stack

- **Rendering**: [`three`](https://threejs.org) + [`@react-three/fiber`](https://docs.pmnd.rs/react-three-fiber)
  (v9 - its React Native support is built into the main package via a
  `"react-native"` field in its `package.json`, which Metro resolves
  automatically; no separate `/native` import path needed) +
  [`@react-three/drei`](https://github.com/pmndrs/drei) for helpers.
- **GL context**: `expo-gl` (native module - this is what makes Expo Go
  stop working the moment it's installed; see "Expo Go vs. Development
  Build" below).
- **Physics**: no physics engine anywhere. Jaa Atuu's arrow is analytic
  projectile motion (`games/jaa-atuu/JaaAtuuBallistics.ts`). Ordo/Chuko's
  sliding/colliding pieces use a hand-rolled 2D disc physics module
  (`physics/disc2D.ts` - position/velocity/friction/elastic collision on the
  flat XZ plane) instead of a full 3D engine - a flat-surface slide-and-
  collide game is fully, testably solvable analytically (Section 14: "use
  physics only where useful"). Kyz Kuumai/Kok Boru's horses are kinematic,
  not physics-driven (Section 88). `cannon-es` stays installed and unused -
  available if a future game genuinely needs full 3D rigid bodies.
  **`@react-three/rapier`/`@dimforge/rapier3d-compat` was NOT used at all** -
  Rapier ships as WebAssembly, and Hermes (React Native's JS engine) has no
  WASM support, so it cannot run on-device here.
- **Input**: `react-native-gesture-handler` (already a project dependency)
  driving Reanimated shared values, so dragging/holding never triggers a
  React re-render.
- **Orientation**: `expo-screen-orientation`, locked to landscape on mount
  and restored to portrait on unmount by `core/useGameLifecycle.ts`.
- **Dev/native build**: `expo-dev-client`.

## Directory layout

```
src/games3d/
  core/        Canvas host, error boundary, app-lifecycle/orientation hook, game registry, the 3D Game Lab screen
  camera/      Shared camera rigs - AimCamera, IntroCameraSweep, TacticalCamera, ChaseCamera
  controls/    Shared touch input - AimController (hold-to-draw), DragPowerController (pull-to-launch), DragAimIndicator, VirtualJoystick, SprintButton
  physics/     Hand-rolled 2D disc physics (Ordo/Chuko)
  ai/          Shared "honest AI" throw-aim generator (Ordo/Chuko)
  audio/       Generic imperative SFX manager
  ui/          Shared HUD/pause/result/tutorial/intro/countdown/loading/error/context-action overlays
  shared/
    environment/  Sky, mountains, terrain, lighting, boz-uy - reused by every game
    horse/        HorseController (kinematic movement) + HorseModel (placeholder mesh + procedural gait) - shared by Kyz Kuumai and Kok Boru
    scenePalette.ts
  games/
    jaa-atuu/    Archery - PARTIAL, not yet device-tested
    ordo/        Circle-clearing/khan-capture - PARTIAL, not yet device-tested
    chuko/       Throw-and-collect - PARTIAL, not yet device-tested
    kyz-kuumai/  Horse chase - PARTIAL, not yet device-tested
    kok-boru/    Phase A vertical slice (pickup/carry/score, no AI yet) - PARTIAL, not yet device-tested
```

Every game follows the same shape: `<Name>Game.tsx` (screen, wires shared
UI + input), `<Name>Scene.tsx` (3D content, owns the per-frame loop),
`<Name>Controller.ts` (the phase/state-machine hook), `<Name>Types.ts`.
Ordo and Chuko additionally split out `<Name>PhysicsWorld.ts` (physics only)
and `<Name>RulesEngine.ts` (rules only) per the "PHYSICS VS RULES"
separation - see below.

## How to run it

This app is on Expo SDK 54. `expo-gl` is a native module, so **Expo Go can
no longer run any screen under `src/games3d`** - it needs a Development
Build.

```
npm install          # already done for this phase
npx expo start        # then open the app via a Development Build, not Expo Go
```

To build a Development Build (this machine has no Xcode/Android Studio, so
builds run on EAS's cloud infrastructure):

```
eas build --profile development --platform ios
eas build --profile development --platform android
```

Install the resulting build on your device, then `npx expo start` and open
the project from inside that build (it has its own dev-menu, separate from
Expo Go).

## Where to test

- **3D Game Lab** (dev-only test bench, not linked from production nav):
  `/games/3d-lab` - lists all 5 games from the registry and lets you jump
  straight into whichever has a route, skipping the production Games hub.
- **Direct routes**: `/games/jaa-atuu`, `/games/ordo`, `/games/chuko`,
  `/games/kyz-kuumai`, `/games/kok-boru`.
- The production Games hub (`src/features/games/mockData.ts`) intentionally
  still has **no** `route` set on any of the corresponding entries, so they
  keep showing as "Coming soon" there until each has been verified on a
  real device - see Section 6/95 of the build brief this was built against.

## Game state machine

Every game's controller should use the shared `GamePhase` union from
`core/gameTypes.ts` - `LOADING | INTRO | TUTORIAL | READY | PLAYING | PAUSED
| RESULT` - instead of inventing ad hoc booleans (`isPlaying`,
`didStart`, ...). Jaa Atuu's `JaaAtuuController.ts` is the reference
implementation: `PAUSED` is a real phase (backgrounding and the pause
button both drive into it, remembering what phase to restore on resume),
not a boolean bolted on next to the phase. `useGameLifecycle` only reports
`isBackgrounded` - it doesn't own pause state itself; the game screen
decides what "paused" means by calling its own controller's `pause()`.

## Intro sweep

`ui/GameIntroCard.tsx` (a ~2.4s translucent title card, tap-to-skip) and
`camera/IntroCameraSweep.tsx` (a shared camera rig that lerps from a wide
establishing shot to wherever the gameplay camera will pick up) are both
reusable by every game's `INTRO` phase, not Jaa Atuu-specific. Replays skip
straight to `READY` - the intro/tutorial only show once per session.

## Per-shot feedback

`ui/ShotFeedback.tsx` is a shared transient score-popup ("+100" / "ӨТТҮ")
component, retriggered by bumping an incrementing `key` so repeated
identical outcomes (two misses in a row) still animate. Not gated on game
phase - the last shot of a round resolves in the same tick the phase flips
to `RESULT`, so gating the popup on `READY`/`PLAYING` would silently drop
it (this was a real bug caught and fixed during this phase).

## Audio

`audio/GameAudioManager.ts` is a shared, generic (`<TSlot extends string>`)
imperative SFX player built on `expo-audio`'s `createAudioPlayer`. A game
defines its own slot union (`games/jaa-atuu/jaaAtuuAudio.ts` -
`'draw'|'release'|'impactLight'|'impactMedium'|'impactHeavy'|'miss'`) and a
`{slot: assetModule}` map; a slot with no asset registered safely no-ops.
**No SFX assets exist yet for any game** - every `play()` call in
`JaaAtuuGame.tsx` currently no-ops; haptics (`expo-haptics`, already wired)
are the only real feedback right now. Drop files into the map in
`jaaAtuuAudio.ts` to activate a sound - no call-site changes needed.

## How physics/scoring work (Jaa Atuu)

No physics engine. `JaaAtuuBallistics.ts` computes an analytic parabola:
launch speed is `lerp(16, 30, power)` m/s, and the launch pitch auto-solves
the standard projectile-range equation for that speed/distance so a
straight (`aimY = 0`) shot arcs onto the target at any draw strength -
`aimY` then nudges the pitch up/down from that baseline, `aimX` sets yaw.
Every frame, `JaaAtuuScene`'s `useFrame` evaluates the arrow's position at
the elapsed flight time and checks whether it has crossed the target's
z-plane or the ground; scoring is the radial distance from the target
center at the crossing point, resolved against `JAA_ATUU_RINGS`
(`JaaAtuuTypes.ts`) - not from a texture or hit-tested against a hidden
collider.

**This scoring shape (10/25/50/100 concentric rings, 12/18/26m distance by
difficulty, 5 arrows) is a MOBILE PROTOTYPE ADAPTATION, not a sourced
traditional Kyrgyz archery rule.** Difficulty (`JaaAtuuTypes.ts` -
`JAA_ATUU_DIFFICULTY`) changes two real variables - target distance and an
`aimAssistScale` that dampens raw drag input before it reaches the
ballistics math (larger scale = a given drag moves the aim point less,
which behaves like a bigger target without touching the target's actual
ring radii). There is no difficulty-picker UI yet - `'normal'` is
hardcoded in `JaaAtuuGame.tsx`. `games/zhaaAtuu/RULES.md` (written before this phase) found
only historical technique names for Жаа атуу, no modern distances, scoring
system, or equipment spec - see that file and `docs/GAME_ASSETS.md` for the
full note.

## Performance choices made for mobile

- One directional light + one hemisphere light, nothing else
  (`shared/environment/SceneLighting.tsx`).
- Shadows are enabled only on the directional light and only cast by the
  target/arrow, not the whole terrain.
- The sky is vertex-color gradient geometry, not a procedural atmospheric
  shader.
- `dpr` is clamped to a max of 2 regardless of device pixel ratio
  (`core/Game3DCanvas.tsx`).
- `frameloop="never"` while paused/backgrounded - the GL context stays
  alive (cheap to resume) but nothing renders or ticks.
- No postprocessing.
- Per-frame state (arrow position, bow-string pull, camera look-offset) is
  driven by refs/`useFrame` mutation, never `setState`, so a flying arrow or
  a held draw doesn't cause 60 React re-renders/sec (Section 86/87).

**Not yet measured on a real device** - see the final report for this phase
for what's been verified vs. what still needs an on-device pass before any
FPS/performance claim.

## How to add a new 3D game

1. Add its entry to `src/games3d/core/gameRegistry.ts` (`route: null`,
   `status: 'COMING_SOON'` until it's real).
2. Create `src/games3d/games/<id>/` with `<Name>Types.ts`,
   `<Name>Controller.ts`, `<Name>Scene.tsx`, `<Name>Game.tsx`, following
   `jaa-atuu`'s shape.
3. Reuse `core/Game3DCanvas`, `core/useGameLifecycle`, `core/Game3DErrorBoundary`,
   the `ui/*` overlays, and `shared/environment/*` rather than
   reimplementing them.
4. Add a route file under `src/app/games/<id>.tsx` that just renders the
   game's top-level `<Name>Game` component.
5. Flip the registry entry's `route`/`status` once it's genuinely playable,
   and add localization keys under a new `games3d.<id>` block in all three
   `src/i18n/locales/*.json` files.
6. Only once verified on a real device: set `route` on the corresponding
   entry in `src/features/games/mockData.ts` to surface it in the
   production Games hub.

## Known limitations - Jaa Atuu specifically

- No GLB models - see `docs/GAME_ASSETS.md`.
- Bullseye feedback is a brief (~900ms) camera zoom-in/out toward the
  target, not literal slow motion (no time-dilation of the physics/render
  loop) - a simplification of the "small slow-motion moment" ask.
- No SFX assets - see "Audio" above. Haptics only.
- No difficulty-picker UI - `'normal'` is hardcoded even though all three
  presets exist and work.
- No LOW/MEDIUM/HIGH quality-mode switch yet (Section 16) - there's only one
  quality level right now, tuned conservatively (no postprocessing, capped
  shadow map size, capped `dpr`).
- Not yet verified on a real iOS or Android device - see the final report.

## Cross-cutting limitations (all 5 games)

- No GLB models anywhere - every game is primitive geometry (see
  `docs/GAME_ASSETS.md`).
- No SFX assets anywhere - haptics only.
- No LOW/MEDIUM/HIGH quality-mode switch.
- No difficulty-picker UI in any game, even where difficulty presets exist
  and work (Jaa Atuu, Ordo, Chuko, Kyz Kuumai).
- **None of the 5 games have been run on a real device yet** - "PARTIAL" on
  every registry entry, not "PLAYABLE", pending that verification.

## Ordo

`games/ordo/RULES.md` ("core rules verified from a Kyrgyz national-sport
source"): a cluster of pieces rings a central khan; players throw from
outside a circle to knock pieces out; a side must clear 3 regular pieces
before it may legally capture the khan; capturing the khan awards it + 3
pieces, the opponent gets 2 as consolation. **Adaptation**: 1v1 (not 7-a-
side teams), a reduced piece count for mobile pacing, and the "3 before
khan" rule is enforced by `OrdoRulesEngine.ts` rejecting/returning an
early khan hit rather than restricting where the player can aim. Physics:
`OrdoPhysicsWorld.ts` on `physics/disc2D.ts`. Input:
`controls/DragPowerController.ts` (pull-back-and-release, power from drag
distance - a genuinely different shape from Jaa Atuu's hold-to-draw, not
just different constants). Turn structure is its own `OrdoPhase` (extends
the shared `GamePhase` with `PLAYER_TURN`/`SETTLING`/`AI_TURN` - Ordo
needs a real "wait for physics to settle before evaluating" state the base
set doesn't have). AI: `OrdoAI.ts`, wraps the shared
`ai/computeThrowAim.ts`.

## Chuko

`games/chuko/RULES.md`: Chuko is a family of 80+ named variants, not one
game - the source itself warns not to present any single one as "the"
official version. This builds **Variant A ("throw-and-collect")**, the
best-attested and simplest: pieces arranged in a circle, players take
turns throwing to knock pieces out, thrower collects what they knock out,
most collected when the circle empties wins. Reuses Ordo's entire physics/
input/AI shape (`ChukoPhysicsWorld.ts`, `ChukoRulesEngine.ts` - no khan/no
threshold, 1 point per capture) - see `ChukoTypes.ts` for the full
TRADITIONAL RULE vs ADAPTATION note, including why Variant B (упай
points-per-face scoring) was NOT built this pass.

## Kyz Kuumai

`games/kyzKuumay/RULES.md` ("core structure verified"): a two-phase chase
- the girl rides first with a head start, the boy chases, and the sourced
traditional resolution on a catch is described as a kiss. **The source
itself flags this needs an explicit non-literal design decision before
implementation** for an all-ages app. This build's resolution: a chaser
closing to `CATCH_RADIUS_M` of the lead rider wins the round - the catch
itself has **no kiss animation or equivalent literal gesture**, roles are
named generically (chaser/lead rider, not gendered), and Phase 2 (role
reversal on a failed catch) is NOT implemented (its win condition is
UNVERIFIED in the source - this build is Phase 1 only). Introduces the
shared `shared/horse/HorseController.ts` (kinematic, unit-tested) and
`HorseModel.tsx` (placeholder + procedural gait), `camera/ChaseCamera.tsx`,
and track-progress-based distance (`KyzKuumaiTrack.ts` - arc-length
projection onto the course, not raw world Z) instead of a naive Z-distance
check.

## Kok Boru

No `games/kokBoru/RULES.md` exists - Kok Boru is new to this 3D phase, not
one of the originally-researched 9 games, so it has had **no dedicated
cultural-research pass**. Per the master brief's own explicit phasing
("PHASE A: 1 player, 1 horse, object, goal... Nothing else. Make this work
first"), this build is **Phase A only**: ride, pick up an object near you,
carry it, ride it into the goal circle to score. No AI opponent, no
possession contest/stealing, no match timer-to-N, no real traditional
match rules - those need Phase B+ and a proper cultural-research pass
first, in that order. Possession is explicit state
(`KokBoruPossession: 'FREE' | 'PLAYER'`), not inferred from physics
collisions. Reuses `HorseController`/`HorseModel`/`ChaseCamera` from Kyz
Kuumai (Section "Do not implement a completely separate horse controller
for Kok Boru later") with a higher/farther-back camera offset for
situational awareness, and a single context-sensitive action button
(`ui/ContextActionButton.tsx` - "PICK UP"/"DROP", never both at once).
