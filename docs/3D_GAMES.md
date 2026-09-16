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
  core/        Canvas host, error boundary, app-lifecycle/orientation/background-pause hook, shared frame-delta clamp, game registry, the 3D Game Lab screen
  camera/      Shared camera rigs - AimCamera, IntroCameraSweep, TacticalCamera, ChaseCamera
  controls/    Shared touch input - AimController (hold-to-draw), DragPowerController (pull-to-launch), DragAimIndicator, VirtualJoystick, SprintButton
  physics/     Hand-rolled 2D disc physics (Ordo/Chuko)
  ai/          Shared "honest AI" throw-aim generator (Ordo/Chuko)
  audio/       Generic imperative SFX manager
  haptics/     Shared expo-haptics wrapper (settings-aware, spam-throttled)
  ui/          Shared HUD/pause/result/tutorial/intro/countdown/loading/error/context-action/FPS-counter overlays
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
- The production Games hub (`src/features/games/mockData.ts`) now also links
  directly to Jaa Atuu, Ordo, Chuko, and Kyz Kuumai (their existing cards'
  `route` was set once each had been verified running - via browser, not yet
  on a real device - see the final report for this phase). Kok Boru has no
  card there yet since it has no `games/kokBoru` thumbnail asset - reach it
  via `/games/kok-boru` directly or the 3D Game Lab.

## Game state machine

Every game's controller should use the shared `GamePhase` union from
`core/gameTypes.ts` - `LOADING | INTRO | TUTORIAL | READY | PLAYING | PAUSED
| RESULT` - instead of inventing ad hoc booleans (`isPlaying`,
`didStart`, ...). Jaa Atuu's `JaaAtuuController.ts` is the reference
implementation: `PAUSED` is a real phase (backgrounding and the pause
button both drive into it, remembering what phase to restore on resume),
not a boolean bolted on next to the phase. `useGameLifecycle` doesn't own
pause state itself - the game screen's own controller decides what
"paused" means by exposing `pause()`/`resume()`.

## App background auto-pause

`useGameLifecycle(orientation, onBackground?)` takes the controller's
`pause` as its second argument and calls it itself the instant
`AppState` reports the app left `'active'` (a phone lock, a notification
shade pull, switching apps, ...) - every game screen used to duplicate
this as its own `useEffect(() => { if (isBackgrounded) game.pause(); },
[isBackgrounded])`; centralizing it in the one hook every game already
calls removed that duplication (Section "shared system so we don't
duplicate code") without changing what it does. Deliberately does nothing
on returning to the foreground - `isBackgrounded` flipping back to `false`
triggers no callback at all, so gameplay never auto-resumes; the phase
stays `PAUSED` and `PauseMenu` (gated on `phase === 'PAUSED'`) is exactly
what a returning player sees, same as pausing manually. Resuming is always
`PauseMenu.onResume` - a real tap, never automatic.

Pausing this way also stops the game timer and AI movement for free,
without `useGameLifecycle` needing to know anything about either: both
live inside per-scene `useFrame` callbacks, and `core/Game3DCanvas.tsx`'s
`frameloop={isPaused ? 'never' : 'always'}` (`isPaused` = `phase ===
'PAUSED'`) means `useFrame` - and therefore every game's `onTick`,
possession/AI-stepping, and physics `world.step` - simply doesn't run at
all while paused, backgrounded or not.

**Preventing large frame/delta jumps on return**: `core/frameDelta.ts`
exports `clampFrameDelta()`, a ceiling of 1/20s (50ms) on any single
`useFrame` delta - used by every game's `useFrame` before it reaches a
physics step (`OrdoScene`/`ChukoScene`'s `world.step`) or a per-frame time
accumulator (Jaa Atuu's arrow-flight clock, Kyz Kuumai/Kok Boru's
`HorseController.step`/AI stepping). This matters because `frameloop`
freezing while paused doesn't freeze the underlying clock `useFrame`'s
`delta` is measured against - the first frame after a long manual pause or
background stint would otherwise report a delta of however long the pause
lasted (seconds, minutes, longer), which for a physics `world.step` risks
tunneling/instability, and for Jaa Atuu's arrow would instantly evaluate
the analytic flight path at a bogus far-future time instead of the arrow's
real position. Under normal play the clamp never triggers (a real 60fps
frame's delta is ~0.016s, far under 1/20s) - Kyz Kuumai and Kok Boru
already clamped this inline before this pass; the fix here was making
Ordo/Chuko/Jaa Atuu do the same and moving all five onto the one shared
constant instead of two of them re-deriving `1/20` locally.

## Intro sweep

`ui/GameIntroCard.tsx` (a ~2.4s translucent title card, tap-to-skip) and
`camera/IntroCameraSweep.tsx` (a shared camera rig that lerps from a wide
establishing shot to wherever the gameplay camera will pick up) are both
reusable by every game's `INTRO` phase, not Jaa Atuu-specific. Replays skip
straight to `READY` - the intro/tutorial only show once per session.

## Loading transitions

Two pieces, both shared so no game hand-rolls its own:

- `core/Game3DCanvas.tsx` fades its Canvas in from fully transparent over
  220ms, triggered by `<Canvas onCreated>` - R3F's own signal that the GL
  context/renderer exist and the scene is about to paint its first frame,
  not a guessed timeout. Lives once in the one Canvas host every game
  already renders through, so all 5 games get it with zero per-game code -
  masks the brief empty/black flash a fresh GL surface can otherwise show
  before its first real paint (Section "Prevent the player from briefly
  seeing an empty/unfinished scene").
- `ui/LoadingOverlay.tsx` now takes an explicit `visible` prop (defaults to
  `true` so a bare `<LoadingOverlay progress={x}/>` with no prop still
  behaves exactly as before) instead of the caller conditionally mounting/
  unmounting it - Jaa Atuu/Kyz Kuumai/Kok Boru now all render
  `<LoadingOverlay visible={modelsLoading} .../>` unconditionally, and the
  component stays mounted (and touch-blocking, since it's an opaque
  full-bleed view with default `pointerEvents`) for 220ms after `visible`
  goes false to fade its own opacity out, instead of popping away the
  instant the GLB finishes. That same "still mounted while fading" window
  is also what satisfies "prevent gameplay controls from working while
  loading" - nothing under an opaque, touch-blocking overlay is reachable
  until it's actually gone, fade included, with no per-game phase-gating
  changes needed. Only Jaa Atuu/Kyz Kuumai/Kok Boru show this at all -
  Ordo/Chuko have no GLB to wait on, so they only get the Canvas fade-in
  above.

## Pre-match countdown

`ui/StartCountdown.tsx` (originally built for Kyz Kuumai/Kok Boru's
"KYZ KUUMAI — INTRO" beat, now shared by all 5) shows "3, 2, 1, БАШТА!"
exactly once per match, in normal mode only, between the tutorial ending
and gameplay actually starting - never in practice mode, never again
mid-match. Adds a haptic pulse per step (`gameHaptics.light()` for 3/2/1,
`.heavy()` for GO) inside the shared component itself, so every game gets
it for free. No new sound asset was added - nothing in the existing
per-game SFX (docs/GAME_ASSETS.md) reads as a generic countdown tick, and
sourcing one would be a fresh licensing decision outside a "reuse if
suitable" ask.

**How the freeze is enforced differs by controller shape, on purpose**:

- **Kyz Kuumai / Kok Boru**: `READY` is already a genuine one-time
  pre-match phase for these two (chase/riding games have no discrete
  "turns" that return to it), so the countdown gates the controller's own
  `startChase()`/`start()` call directly - `<StartCountdown
  visible={phase === 'READY' && mode === 'normal'} onDone={game.startChase}
  />`. Since movement/AI-stepping/the match timer only run once `phase ===
  'PLAYING'` (Section "App background auto-pause"), and nothing reaches
  `PLAYING` until the countdown's `onDone` fires, everything is frozen for
  free - no extra gating needed. Practice mode calls `startChase()`/
  `start()` immediately instead, via a small effect, skipping the
  countdown entirely.
- **Jaa Atuu / Ordo / Chuko**: their equivalent "ready" phase (`READY` for
  Jaa Atuu, `PLAYER_TURN` for Ordo/Chuko) is reused after *every* shot/
  throw, not just once - delaying the controller's own phase transition
  the same way would show the countdown before every single shot, not
  just the match's first. Instead, each `<Name>Game.tsx` tracks its own
  one-shot `showCountdown`/`countdownShownRef` locally: the first time
  `phase` reaches that value in normal mode, it shows the countdown
  (guarding against the phase's later, per-turn re-entries), and gates
  `useAimController`/`useDragPowerController`'s own `enabled` on
  `!showCountdown` in addition to the phase check - this is what actually
  freezes drawing/throwing, since none of the 3 real paths into that phase
  (tutorial just finished, tutorial already seen this session, or a
  replay) goes through one single interceptable function call. The guard
  ref resets on `restart()` so a replay shows the countdown again. No
  controller/gameplay-mechanics code was touched for any of the 5 games -
  every change lives in the `<Name>Game.tsx` UI layer or the shared
  `StartCountdown` component itself.

Both shapes also hide the countdown while `phase === 'PAUSED'` (backgrounding
or a manual pause mid-countdown) rather than letting it keep ticking behind
the pause menu - resuming restarts the 3-2-1-GO sequence from the top
rather than trying to resume a partial one.

## Per-shot feedback

`ui/ShotFeedback.tsx` is a shared transient score-popup ("+100" / "ӨТТҮ")
component, retriggered by bumping an incrementing `key` so repeated
identical outcomes (two misses in a row) still animate. Not gated on game
phase - the last shot of a round resolves in the same tick the phase flips
to `RESULT`, so gating the popup on `READY`/`PLAYING` would silently drop
it (this was a real bug caught and fixed during this phase).

## Audio and haptics

`audio/GameAudioManager.ts` is a shared, generic (`<TSlot extends string>`)
imperative SFX player built on `expo-audio`'s `createAudioPlayer`. Each game
defines its own slot union and a `{slot: assetModule}` map in a per-game
`<name>Audio.ts` file (`jaaAtuuAudio.ts`, `ordoAudio.ts`, `chukoAudio.ts`,
`kyzKuumaiAudio.ts`, `kokBoruAudio.ts`) - a slot with no asset registered
safely no-ops, so this same architecture was already correct when only Jaa
Atuu had empty slots.

**All 5 games now have real, licensed sound effects** - see
`docs/GAME_ASSETS.md`'s "Sound Effects" table for the exact source file/
pack/license backing every slot. All of it is CC0 (public domain, Kenney.nl)
- no attribution legally required, though Kenney's license file asks for it
"nicely." A few slots are honest stylized stand-ins rather than literal
recordings (bow draw/release use RPG-foley knife sounds; Kok Boru's "final
whistle" is a bell strike) since no closer real recording existed in the
sourced CC0 packs - documented per-slot in the same table, not silently
passed off as authentic.

`haptics/gameHaptics.ts` is the equivalent shared entry point for
`expo-haptics` - every game calls through it instead of the library
directly. Two things live there once instead of per call-site: a
`useSettingsStore().game.haptics` check, and a 120ms cross-game throttle so
a burst of events (e.g. rapid Kok Boru possession changes) can't spam the
device with haptic pulses.

**Respecting settings**: `GameAudioManager.play()` itself checks
`useSettingsStore().game.soundEffects` before playing anything, and every
volume passed to `play()` is a conservative per-event value already capped
below 1.0 inside the manager (Section "don't play every sound too loudly").
There is no numeric volume slider - `GameSettingsScreen`'s existing
architecture only has on/off `Toggle` rows (`soundEffects`/`music`/
`haptics`), no slider component or volume field in `useSettingsStore`
exists to attach one to, so this pass respects mute rather than inventing a
new settings control beyond what "if the existing settings architecture
supports it" covers. `music` stays unused - no background music was added,
per the task's own "not yet" instruction.

**Platform handling**: `expo-haptics`'s own web implementation already
falls back to `navigator.vibrate`/a no-op (see its `ExpoHaptics.web.ts`);
`gameHaptics`'s try/catch covers devices/simulators with no haptics engine
at all. `GameAudioManager.play()` is wrapped in try/catch for the same
reason on the audio side (e.g. no usable output device). None of this has
been confirmed on a real device yet - see the final report for this phase.

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

**Dev-only FPS counter**: `ui/FpsCounter.tsx` is mounted once in
`core/Game3DCanvas.tsx` (the one shared Canvas host every game already
renders through), so all 5 games show it automatically with zero per-game
wiring. It counts frames via `requestAnimationFrame` - deliberately
independent of react-three-fiber's own render loop, so it's a plain RN
`View`/`Text` sibling of `<Canvas>`, not a Three.js object, and never
touches any game/graphics code. Gated on `__DEV__`: the component returns
`null` outright (not just visually hidden) when `__DEV__` is `false`, which
Expo/RN set to `false` in a release/production JS bundle - so it costs
nothing and shows nothing in production. Sampling is throttled to 2
`setState` updates/sec regardless of actual frame rate, so it doesn't add a
React re-render on every rendered frame.

**Shadows were a silent no-op until the visual-polish pass** - `@react-three/
fiber`'s `<Canvas>` defaults its `shadows` prop to `false` (confirmed by
reading the installed library source), and `core/Game3DCanvas.tsx` never set
it, so every `castShadow`/`receiveShadow`/shadow-camera-bounds already
present across `SceneLighting.tsx`, `JailooTerrain.tsx`, the character/horse
models, and the archery target never actually rasterized a shadow in any of
the 5 games - `gl.shadowMap.enabled` was simply off. The polish pass set
`shadows="soft"` on that `<Canvas>` (`PCFSoftShadowMap`, the softer-edged
filter this pass specifically asked for), using the same 1024² shadow-map
size and camera bounds already budgeted in `SceneLighting.tsx` - not a new
cost class, but a genuine rendering-cost change (shadows now actually
sample every frame where before they cost nothing). **This needs a real
on-device FPS re-check across all 5 games before any performance claim
about the current build** - it was verified only via `expo export --platform
web` (bundles/resolves correctly), not by seeing it render.

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

- The archer is now a real CC0 GLB (`CharacterLoader`, `quaterniusHuman` -
  see `docs/GAME_ASSETS.md`) with a kalpak/quiver attached to its bones and
  Idle/Walk/Run clips (no Aim/Shoot clips exist in this asset - the
  existing shoulder-rotation bow-draw pose from `CharacterAnimator.ts`
  still applies directly to the real bones, so aiming/drawing still reads
  correctly without a dedicated clip). `tsc`/tests pass and the model
  bundles/resolves correctly through Metro (verified via `expo export`),
  but it has **not been visually reviewed by a human or run on a device** -
  treat scale/kalpak/quiver fit as unverified until someone actually looks.
- Bullseye feedback is a brief (~900ms) camera zoom-in/out toward the
  target, not literal slow motion (no time-dilation of the physics/render
  loop) - a simplification of the "small slow-motion moment" ask.
- Real CC0 SFX + haptics for draw/release/hit/bullseye/result - see "Audio
  and haptics" above. No background music.
- No LOW/MEDIUM/HIGH quality-mode switch yet (Section 16) - there's only one
  quality level right now, tuned conservatively (no postprocessing, capped
  shadow map size, capped `dpr`).
- Not yet verified on a real iOS or Android device - see the final report.
- Practice mode extends the round (more arrows) rather than removing
  scoring - personal best (AsyncStorage-only, no leaderboard) is tracked for
  'normal' rounds only, since practice's arrow count isn't comparable.

## Known limitations - Kyz Kuumai specifically

- Both horses are now the same real CC0 GLB (`HorseLoader`, `quaterniusHorse`)
  with real Idle/Walk/Gallop clips - there's no dedicated Trot clip in this
  asset, so the TROT gait state currently plays the Gallop animation (see
  `modelManifest.ts`'s comment on this). The AI horse's coat is tinted via a
  cloned-and-recolored copy of the GLB's own materials (`useTintedScene`,
  using `SkeletonUtils.clone` so the clone's own skeleton/animation doesn't
  break or cross-contaminate the player horse's) so it doesn't look like an
  exact duplicate. The rider stayed procedural (`GenericRider` in
  `HorseLoader.tsx`) rather than also becoming a GLB - a simpler seated pose
  that doesn't depend on this specific horse's exact back width, per
  Section 10's "visually acceptable seated pose" allowance. Saddle position
  was computed from the GLB's own spine bones, not eyeballed - like the
  archer, **not yet visually reviewed by a human or run on a device.**

## Known limitations - all 5 games

- Ordo, Chuko, and Kok Boru are untouched by the GLB work this pass and
  remain full primitive geometry (see `docs/GAME_ASSETS.md`) - only Jaa
  Atuu's archer and Kyz Kuumai's horses were migrated, per the explicit
  "prove the pipeline on 2 games, don't touch the rest yet" scope.
- All 5 games now have real CC0 SFX + haptics for their key events (see
  "Audio and haptics" above) - none of it confirmed on a real device yet,
  and no background music (not requested for this pass).
- No LOW/MEDIUM/HIGH quality-mode switch.
- **None of the 5 games have been run on a real device yet** - "PARTIAL" on
  every registry entry, not "PLAYABLE", pending that verification. This
  environment also has no working browser preview (Chrome extension
  unavailable) - the two new GLBs are verified to bundle/resolve correctly
  (`tsc`, `jest`, and a full `expo export --platform web` all pass clean)
  but have not actually been *seen* rendered by anyone yet.
- A pre-entry `GameDetailScreen` (What is this / how to play / difficulty /
  best score / games played / achievements / a Culture link) now gates
  every game's route (`src/app/games/<id>.tsx`, same state-gate shape
  `besh-tash.tsx` already used) - but its in-game equivalents
  (`GameAboutCard`/`TutorialOverlay`) still play too on first entry, so a
  first-time player currently sees "how to play" twice. Only Jaa Atuu has a
  real Practice-vs-Play behavior split; the other 4 games' Practice button
  starts the same match as Play (noted at each route file). Difficulty
  presets are wired for Jaa Atuu/Ordo/Chuko/Kyz Kuumai; Kok Boru has none
  (Phase A has no AI to scale). "Best score" only shows for games with a
  single higher-is-better number (Jaa Atuu/Ordo/Chuko) - Kyz Kuumai/Kok Boru
  show games-played only (a time-based chase and a score-or-don't slice
  don't have one).
- All 5 games now call `useProgressStore().recordGamePlayed(gameId)` on
  reaching `RESULT` - Games-hub `gamesPlayed` stats were previously
  disconnected from every 3D game.

## Visual polish pass (environments)

Explicitly a **visuals-only** pass - no gameplay, physics, controls, or
scoring changed anywhere in this section; only files under
`shared/environment/`, `shared/scenePalette.ts`, `core/Game3DCanvas.tsx`,
and each game's own `*Field.tsx`/`*Range.tsx`/`*Course.tsx`/`*Arena.tsx`
environment-dressing file were touched.

- **Shadows enabled** - see "Performance choices made for mobile" above;
  `shadows="soft"` on `Game3DCanvas`'s `<Canvas>` is the single biggest
  change in this pass and the one most in need of a real-device FPS check.
- Three new shared, reusable dressing primitives added to
  `shared/environment/` (all cheap low-poly/flat-shaded, matching the
  existing `MountainBackdrop.tsx` visual language, all using the
  deterministic `Math.sin`-based pseudo-random pattern rather than
  `Math.random()` so scatter layouts don't reshuffle on re-render):
  - `Flag.tsx` - a pole + a single banner plane that gently rocks in
    `useFrame` (whole-mesh rotation, not per-vertex cloth sim) for cheap
    "subtle environmental movement."
  - `Rock.tsx` (`RockCluster`) - a small scatter of undivided icosahedrons.
  - `Bush.tsx` - a 3-lobe icosahedron cluster standing in for vegetation.
- `MountainBackdrop.tsx`: the farthest row now gets a small second cone at
  each peak's apex in a new `scenePalette.snow` tone, read as snow caps.
- `KyrgyzSky.tsx`: added `Clouds` - 5 drifting puffs, each 3 flattened
  spheres (no image texture, so no licensing question), looping across the
  sky via one `useFrame` position lerp per cloud.
- `JailooTerrain.tsx`: the ground plane is now vertex-colored (a
  deterministic `grass`/`grassShadow` patch blend from a `Float32BufferAttribute`
  built once in `useMemo`) instead of one flat material color - same
  triangle/segment count as the flat variant, just an added per-vertex
  color attribute, so it's free at render time relative to before.
- `BozUy.tsx`: added a `scenePalette.felt` trim band around the wall/roof
  seam and a dark doorway recess + wood lintel on the front face - still 5
  primitives per yurt, not a geometry rebuild.
- Per-game integration, kept inside each game's own stated identity
  (Section: "Do not make every game visually identical"):
  - **Jaa Atuu** (archery training field): the two bare-cylinder distance
    markers became real `Flag`s; sideline `RockCluster`/`Bush` added well
    outside the dirt lane so nothing can ever sit in an arrow's flight path.
  - **Ordo** (traditional open playing area): four `Flag`s frame the play
    ring from just outside its boundary; a couple of `RockCluster`/`Bush`
    scattered further out.
  - **Chuko** (smaller social/play area): gained its first `BozUy` (singular
    - kept small/close, not Ordo's multi-yurt festival scale) plus one
    `Bush`/`RockCluster`, all outside the mat/border rings.
  - **Kyz Kuumai** (open mountain horse-riding track): the bare-cylinder
    checkpoint posts became real `Flag`s (gold at the finish, terracotta at
    every other checkpoint); sparse `RockCluster`s placed to one side of
    each waypoint (never on the dirt trail itself) plus two `Bush`es.
  - **Kok Boru** (larger competitive field): the bare-cylinder goalposts
    became real `Flag`s in each goal's own ring color; `RockCluster`/`Bush`
    added at the field edges, clear of both goals, the object-spawn point,
    and the riding lane between them.
- **Needs real-device visual verification** (not yet seen rendered by
  anyone - this environment has no working browser preview; verified only
  via `tsc`, `jest`, and a full `expo export --platform web` bundling
  clean): whether shadows actually look good once they render for the
  first time (softness, shadow-acne, peter-panning on any mesh), the new
  cloud puffs' scale/placement relative to `MountainBackdrop`'s peaks, the
  vertex-colored ground's patch scale (may read too subtle or too busy on
  a small phone screen vs. this description), and every new prop's exact
  placement relative to its game's actual play area on-device (desktop-web
  export only proves it bundles and mounts, not that the composition reads
  well).

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

## Camera collision protection (Kyz Kuumai, Kok Boru)

`camera/ChaseCamera.tsx` (shared by both games) used to have no scene
awareness at all - its desired position was a pure function of the horse's
own position/heading, so nothing stopped it from ending up geometrically
inside a `BozUy`/`RockCluster` decoration the horse rode close to, or below
ground level. Fixed, in the one shared component rather than per-game:

- `BozUy.tsx` and `Rock.tsx` (`RockCluster`) tag their outer `<group>` with
  `userData.cameraObstacle = true` - a plain marker with no visual/
  behavioral effect of its own. `Bush`/`Flag` are deliberately NOT tagged
  (small/thin enough that clipping through one briefly isn't the problem
  this is solving, and every extra raycast target costs a little).
- Each frame, `ChaseCamera` casts a ray from near the horse/rider toward
  its desired behind-and-above position and, if it hits a tagged obstacle
  first, clamps the desired position to just short of it
  (`OBSTACLE_MARGIN`). A floor on the resulting distance
  (`MIN_FOLLOW_DISTANCE = 1.6`, well inside both games' 4.2/5.2 defaults)
  keeps the camera structurally outside the horse/rider's own body even
  under this clamping, and a floor on height (`MIN_CAMERA_HEIGHT = 0.5`)
  keeps it above the flat ground plane both games use.
- The obstacle list is gathered once via `scene.traverse` (these
  decorations are static for a whole match, never added/removed at
  runtime) rather than re-traversed every frame.
- **Smoothness is inherited, not re-implemented**: the (possibly clamped)
  desired position is fed into the exact same `LERP_SPEED`-based smoothing
  the camera already used for normal following, rather than snapping to it
  directly - a correction is just a different target for the same smooth
  lerp, so "keep camera movement smooth" and "prevent sudden camera jumps"
  didn't need a second smoothing pass or any new tuning.

No gameplay/horse-physics change - this only ever moves where the *camera*
sits, never the horse's own position/heading, which stay driven entirely by
`HorseController.step()` as before.

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
cultural-research pass**. Phase A (ride, pick up an object near you, carry
it, ride into a goal circle, no opponent) shipped first, per the master
brief's own explicit phasing. **Phase B** (this pass) adds a basic playable
1v1 match against a single AI rider - still not the real traditional game
(no teams, no real match rules, no fouls), and still without that
cultural-research pass - a **MOBILE PROTOTYPE ADAPTATION** for a complete,
testable match shape (see `KokBoruTypes.ts`'s scope note).

Normal mode: two goals now (`PLAYER_GOAL`/`AI_GOAL`, opposite ends of the
field, `KokBoruArena.tsx` draws both - gold for the player's, terracotta
for the AI's), a 2-minute match clock, and a `'GOAL_PAUSE'` phase (extends
the base `GamePhase` set, same pattern as Ordo/Chuko's turn-structure
phases) for a short freeze/reset after each goal - horses and the object
reset, the match continues, ending in a `WIN`/`LOSS`/`DRAW` + final score
when the clock runs out. Possession is explicit state
(`KokBoruPossession: 'FREE' | 'PLAYER' | 'AI'`), never inferred from raw
physics collisions. Pickup and stealing are both automatic proximity for
*both* sides in normal mode (Section 5 groups player/AI under the same
"when close enough" condition, and the AI obviously has no button) -
Practice mode is unchanged and keeps Phase A's explicit player-only "PICK
UP" press (`ui/ContextActionButton.tsx`), which is why the pure game logic
lives in a new `KokBoruMatchEngine.ts` (possession/goal/outcome
resolution, unit-tested in `KokBoruMatchEngine.test.ts`) that only
`normal` mode's `onTick` branch calls - practice's own tick logic is
untouched. The AI's steering (`KokBoruAI.ts`) is a simple "seek whatever
point the match state says to chase" helper - the object when free, the
player when the player has it, its own goal when it has it - run through
the same `HorseController.step()` physics as the player (Section "No
teleporting AI"), with a modest speed handicap so it isn't a perfectly
matched opponent, not a scripted rubber-band chase.

Reuses `HorseController`/`ChaseCamera` from Kyz Kuumai (Section "Do not
implement a completely separate horse controller for Kok Boru later") with
a higher/farther-back camera offset for situational awareness. Both riders
now go through `HorseLoader` (the real CC0 GLB horse, same as Kyz Kuumai) -
Phase A had this on the raw procedural `HorseModel` directly; that was a
real gap fixed in this pass, not a new asset.
