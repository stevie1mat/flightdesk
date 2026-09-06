# Flightdeck — Boeing 737 browser simulator

A React + Three.js flight game. Start at idle on the departure runway, take off, fly a selectable waypoint route, intercept the ILS, flare, touch down, reverse, and brake. Flight reports score vertical touchdown speed and centerline offset.

## Run

Requires Node 22.13+ and npm.

```sh
npm install
npm run dev
```

Open the Local URL printed by the server. `npm run build` produces the Sites/Cloudflare deployment. The shared code uses the Vinext React framework from the Sites starter.

## Play

Click **Start flight**, then hold **W** for throttle. Rotate with **↓** at 132 knots. **↑/↓** pitch, **←/→** roll, **Q/E** rudder, **W/S** throttle, **F / Shift-F** extend/retract flaps, **G** gear, **R** reverse, **Space** brakes, **C** camera, **M** map, **P** pause, **A** autopilot, **?** controls. The brake panel button latches the brakes; Space is momentary.

**Fly with guidance** runs a complete flight using the same force integration as manual flying. Turning guidance off returns controls to you. CMD, HDG, ALT and APP are individually selectable. APP couples the localizer and 3° glideslope; manage throttle, flaps and gear yourself when using APP without guidance. Reverse produces force only on the ground. APP assumes a northbound intercept in front of the destination runway.

Gamepad API: left stick roll/pitch, right horizontal axis yaw, triggers throttle, A brakes. Generic controllers expose axes differently; standard-mapped pads are the intended layout. Some browsers require pressing a controller button first.

## Modules

- `lib/flight/physics.ts`: fixed 60 Hz SI-unit lift/drag/thrust/gravity integration; stall lift loss, ground effect, gusts, steering, AP controllers, contact, scoring.
- `lib/flight/rendering.ts`: procedural 737, airports, terrain and skyline, Sky shader, PBR, dynamic shadows, SSAO/bloom, instanced scenery, mountain LOD, rain, cameras.
- `lib/flight/input.ts`: keyboard and Gamepad API, focus and blur handling.
- `lib/flight/audio.ts`: Web Audio synthesized engine/wind, mechanical sounds and alerts, initialized after a gesture.
- `components/flight/`: UI, PFD-style instruments, ND map, autopilot and aircraft controls.

## Verification

```sh
node --experimental-strip-types tests/physics.mjs
npx tsc --noEmit
npm run build
```

Integration checks cover full guided flight on both routes, rain/fog with a light crosswind, touchdown order, stopped rollout, idle engines and pause, gear-up/off-runway contact, stall detection, and reverse thrust. Baseline guided landing: about 160 ft/min, nose gear about 2.2 seconds after mains.

## Scope

This is a basic entertainment simulator, not a validated 737 flight model or real navigation system. Scenery is procedural and geographically compressed; KSEA and KPAE names provide context, while runways use a common fictional 36 heading and sea-level elevation. The cockpit is a simplified interactive instrument panel and forward camera, not a fully modeled airline cockpit. Aerodynamics use a point-mass longitudinal model with coordinated bank turns, not a six-degree-of-freedom rigid body. No real aviation data or external services are required.

Rendering targets 60 fps with capped pixel ratio, instancing, LOD and a Performance setting; actual frame rate depends on hardware and was not browser-benchmarked. Browser visual QA and physical gamepad/audio hardware checks were not performed. Optional WebMCP tool registration is feature-detected; no supported WebMCP validation context was available.
