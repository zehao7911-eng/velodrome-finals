# Velodrome Finals

An English, portrait-first HTML5 track cycling championship. Enter the arena, ride a six-rider heat, qualify in the top four and race those finalists. Earn a podium medal and unlock the next cup. Harbor Open, Sundown Cup and Midnight Finals share the oval venue architecture with different lighting, pacing and lap counts.

Hold SPRINT to accelerate. Release it to recover, especially in a banked turn or in the slipstream behind a rival. The game steers through the oval and handles passing automatically. A sustained sprint drains stamina, and exhaustion slows the rider briefly. Space also works on a keyboard. The race pauses when the browser is hidden, and interrupted progress is saved locally.

Original procedural riders have separate face, visor, helmet, clothing and shoe geometry. Limbs meet the bars and crank-linked pedals. The 3D arena includes plank texture, graded turns, stepped stands with instanced spectators, venue signage, an entry arch and a physical medal podium. The supplied Swim Racer recording informed presentation and race structure. No recording, source, model or commercial art from the reference is included.

Open index.html or standalone.html directly in a WebGL-capable browser. Both include the renderer and assets and require no network at runtime. The layout is made for portrait. A small landscape screen prompts the player to turn the device upright. The module source entry is index-source.html when served over HTTP. Run node build.cjs and node tests.mjs. Three.js is bundled under its MIT license in vendor.

GameWave starts a host round on a committed race start or explicit resume of a restored running race. The final classification or a confirmed race abandonment ends that round. Heat and final are separate races. The SDK is optional for independent startup, and the only game save key is velodrome-finals-v1. A confirmed positive like unlocks Lilac, and a confirmed direct comment unlocks Sunset, once per saved profile. Gameplay does not require social interaction. GameWave logic is exercised with mocks, not a real host App import.

The portrait HUD uses a circular sprint dial in the lower-right thumb zone. Its ring and the separate stamina meter report the same resource. The timing panel includes progress through the current lap. Mint track streaks mark an active slipstream, and sprint subtly widens the chase camera unless reduced motion is enabled.
