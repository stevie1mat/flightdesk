# flightdesk

Boeing 737 browser simulator.

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
- `lib/flight/rendering.ts`: aircraft/scenery integration, airports, HDR lighting, dynamic shadows, SSAO/bloom, rain and cameras.
- `lib/flight/scenery.ts`: morning waterfront terrain, scanned grass/asphalt textures, detailed tree LOD, city blocks, coastlines, procedural cloud and reflective-water shaders.
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

Morning visual update: new flights begin at 09:24, in the compact Scenery view. Press **H** or click **Full flight deck** to restore all panels and autopilot controls. The chase camera remains directly behind the aircraft. Scenery is still procedural, not aerial photogrammetry.

## Ultra scenery

The simulator starts in **Performance** mode. The optional **Ultra** graphics preset uses a locally stored 8K photographic sky, an HDR lighting environment, 4K scanned grass and asphalt, 2K surface normal/roughness maps, and an optimized textured tree model. Nearby trees use actual branches/leaves; distant trees use four-angle baked impostors. Water reflects the photographic sky. Asset sources and licenses are in `public/assets/hd/CREDITS.md`.

Ultra renders at the device's pixel ratio up to 2×, capped at 3840×2160, with 4× MSAA and 4096² shadow maps. It does not upscale beyond the available viewport/device resolution. **Settings → Graphics quality** offers High and Performance. Rendering speed depends on the GPU; Ultra is not a 60fps guarantee. Initial local asset loading may take several seconds and is shown in the viewport.

The mesh optimization script expects the original upstream `tree.gltf` and its referenced binary in the input directory, and writes `tree-optimized.gltf` and `tree-optimized.bin`. Run it with `node scripts/optimize-tree.mjs SOURCE_DIRECTORY`. The served tree is the optimized version. This remains a simplified custom world, not satellite imagery or a photogrammetry city.

## Aircraft model update

`lib/flight/aircraft.ts` contains the replacement 737-800 exterior: a smooth lofted fuselage and rounded radome; conformal six-pane cockpit glazing; rounded cabin windows and doors; airfoil-section wings, blended winglets, wing/body fairing; detailed nacelle lips, intakes, fan blades and exhausts; folding main/nose gear with paired tires and hubs; animated flaps, ailerons, elevators, rudder, spoilers, fans and wheels. Static fan and wheel details are batched to reduce draw calls.

The model envelope uses 39.47 m length / 35.79 m span, matching Boeing's published rounded dimensions (39.5 m / 35.8 m); geometry details are custom approximations rather than manufacturer CAD. Reference: https://www.boeing.com/commercial/737ng/737-next-generation-design-highlights

Run `node --experimental-strip-types tests/aircraft.mjs` for geometry, dimensions, landing-gear datum and control-animation checks. The ground pose accounts for pitch about the main gear. The existing point-mass flight model and guided routes remain the same; controls now also drive visible surfaces. This change was checked programmatically; no browser visual inspection was performed.

## Takeoff music

In **Settings → Takeoff music**, select a local MP3, WAV, M4A, or other browser-supported audio file. Music starts on the first liftoff, plays once, pauses/resumes with the flight, and resets for the next flight. The header mute controls music and flight sounds; the separate music volume leaves engine/warning volume unchanged. Warnings temporarily lower the music. Music stops when the flight ends. Files are decoded locally, are not uploaded, and must be selected again after refreshing. No commercial song is bundled.

The selected YouTube video (`kyLuzKbgXAs`) is the default soundtrack, played through the official IFrame player in a visible panel at liftoff. Playback follows pause, mute and music volume. Closing the player turns music off; restart re-arms playback. YouTube requires internet and an embeddable video; browser autoplay restrictions may require pressing Play. Settings offers YouTube, Local file and Off. No YouTube audio is downloaded. Player integration reference: https://developers.google.com/youtube/iframe_api_reference

## Night flying

Click **Day / Night** in the top bar, or choose **Settings → Time of day → Night**. Both airports have runway edge/centerline/threshold lights, approach lights, blue taxiway edges, green taxiway centerlines and apron lighting. The city has illuminated windows and streets; aircraft landing lights illuminate the runway with gear down. Clear nights include stars and a moon. Lighting transitions with the time slider and day/night cycle. Performance is the default and uses batched light glows/pools without post-processing or dynamic shadows; High/Ultra retain shadows and bloom. This is a stylized training environment, not a certified airport lighting layout.

## Ground contact effects

Touchdown produces tire-smoke puffs and skid marks. Tail/wing strikes, gear-up contact, and hard runway impacts produce glowing sparks and a scraping trail; off-runway contact throws dust. Impacts add a short camera jolt and contact sound. After a crash the aircraft slides and slows, with four seconds of visible effects before the report opens; close the report to inspect the scene. Effects work in Performance mode without bloom, freeze on pause and clear on restart. Guided takeoff rotation is limited to avoid tail strikes. Run `node --experimental-strip-types tests/contacts.mjs` for contact and particle lifecycle checks. Collision detection remains a simplified flat-airfield model, not detailed terrain/building collision or structural breakup.

Exterior cockpit refinement: the six windscreen panes are tessellated onto the curved forward fuselage, with distinct metal bezels, rubber seals, a narrow center pillar and parked wipers. Dark, restrained glass reflections keep the windows readable in bright daylight. The rounded nose/forehead profile is softened. Exterior cockpit details are hidden in the forward cockpit camera. Aircraft checks include outward ray tests confirming that the windshield surface stays ahead of the white fuselage.

Boeing-inspired reference livery: pearl white above a deep-blue belly, turquoise accent band and aft stripes, a patterned turquoise fin, white BOEING wordmarks and 737 tail markings. Paint is shaded in local model coordinates; lettering uses compact locally generated canvas textures. The aircraft remains the game's 737-800 approximation, rather than becoming a MAX. Fixed wing surfaces, leading-edge metal and movable trailing-edge panels are separated to eliminate overlapping surfaces. Engine spinner spirals, nacelle seams and smoothed control-surface motion add detail.

Rear-aircraft update: a brighter turquoise tail mosaic, broad pale-blue sweeping accent, larger white 737 tail numerals, and a patterned dorsal transition into the striped aft fuselage. The rudder shares the fin paint, horizontal tailplanes have a silver upper finish and blue-toned underside, and the tail cone ends in a recessed APU exhaust with a metallic rim. These are custom reference-inspired details on the existing 737-800 model.

Control towers: both airports use a reference-inspired sculpted concrete structure with three splayed supports, a central shaft, a tapered glass podium and rounded panoramic control cab. Glazing panes, mullions, roof edges, terrace rails, an entrance plaza and antennas are modeled geometry. Material batches keep the detailed tower to a small number of draw calls, with a simpler distant model beyond 1.8 km. Blue/warm window lighting and obstruction beacons follow night mode. The custom tower is an artistic approximation, not an exact architectural model of the photographed building.
