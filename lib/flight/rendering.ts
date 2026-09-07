import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { aircraftBodyHeight, type FlightState } from './physics';
import { MorningScenery,groundHeight,isLand } from './scenery';
import {PilotWorld} from './pilot-world';
import {AircraftInterior} from './interior';
import {pilotCamera} from './pilot-camera';
import {airportObstacles,stepPilot,type PilotState,type PilotInput} from './pilot';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import {NightEnvironment, nightAmount} from './night';
import {ControlTower} from './tower';
import {GroundEffects} from './effects';
import {Boeing737} from './aircraft';
export type GraphicsQuality = 'Performance' | 'High' | 'Ultra';
export type CameraMode = 'Chase' | 'Cockpit' | 'Free';
function material(color: number, roughness = .65, metalness = .05) { return new THREE.MeshStandardMaterial({ color, roughness, metalness }); }
function box(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
export class FlightRenderer {
    private interior!:AircraftInterior;pilot: PilotState|null=null; private pilotWorld!:PilotWorld; private obstacles=airportObstacles(); private stopDrag=()=>{};
    walk(input:PilotInput,dt:number,s:FlightState){if(this.pilot&&!s.paused)stepPilot(this.pilot,input,dt,(x,z)=>{const bridge=x>390&&x<1690&&[820,-24180].some(a=>Math.abs(z-a)<8);if(bridge)return 2;if(Math.abs(x)>19000||z>7000||z<-45000)return null;return isLand(x,z)?groundHeight(x,z):null;},this.obstacles,s);}
    towers:ControlTower[]=[]; effects!: GroundEffects; night!: NightEnvironment; scenery!: MorningScenery; environmentTarget: THREE.WebGLRenderTarget | null = null; visualTime = 0; renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(56, 1, .2, 100000); plane = new Boeing737(); sun = new THREE.DirectionalLight(0xffefd3, 3); ambient = new THREE.HemisphereLight(0xc9e7ff, 0x839b5e, 2.2); sky = new Sky(); composer: EffectComposer; ao: SSAOPass; bloom: UnrealBloomPass; rain: THREE.Points; clouds = new THREE.Group(); mode: CameraMode = 'Chase'; quality: GraphicsQuality = 'Performance'; freeAngle = .65; freeHeight = 24; zoom = 82; disposed = false; resizeObserver: ResizeObserver; lastWeather = ''; lights: THREE.Mesh[] = []; target = new THREE.Vector3(); desired = new THREE.Vector3();
    manager = new THREE.LoadingManager(); assetsReady = false; assetsProgress = 0; assetErrors: string[] = []; hdSky: THREE.Texture | null = null; lastQuality = '';
    constructor(private container: HTMLElement) {
        this.manager.onProgress = (_, loaded, total) => { this.assetsProgress = Math.round(loaded / total * 100); }; this.manager.onLoad = () => { this.assetsReady = true; }; this.manager.onError = url => { this.assetErrors.push(url); };
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = .7; container.appendChild(this.renderer.domElement); this.scene.fog = new THREE.FogExp2(0xb6c8d1, .000028); this.sky.scale.setScalar(80000); this.scene.add(this.sky); const u = this.sky.material.uniforms; u.turbidity.value = 1.6; u.rayleigh.value = 2.8; u.mieCoefficient.value = .002; u.mieDirectionalG.value = .72; u.sunPosition.value.set(-.65, .75, .45); this.scene.add(this.ambient, this.sun); this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024); Object.assign(this.sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 10, far: 1200 }); this.sun.shadow.bias = -.000035; this.sun.shadow.normalBias = .04; this.scene.add(this.sun.target);
        this.interior=new AircraftInterior(this.plane.group);this.buildWorld(); this.effects=new GroundEffects(this.scene); this.night=new NightEnvironment(this.scene,this.plane.group); const pmrem = new THREE.PMREMGenerator(this.renderer); const environmentScene = new THREE.Scene(); environmentScene.add(this.sky.clone()); this.environmentTarget = pmrem.fromScene(environmentScene, .08, .1, 100000); this.scene.environment = this.environmentTarget.texture; this.scene.environmentIntensity = .35; pmrem.dispose(); this.scene.add(this.plane.group); this.camera.position.set(0, 25.8, 1182);
        new THREE.TextureLoader(this.manager).load('/assets/hd/sky-8k.jpg', texture => { if (this.disposed) { texture.dispose(); return; } texture.colorSpace = THREE.SRGBColorSpace; texture.mapping = THREE.EquirectangularReflectionMapping; this.hdSky = texture; this.scenery.waterMaterial.uniforms.skyMap.value = texture; this.scenery.waterMaterial.uniforms.hasSky.value = true; });
        new HDRLoader(this.manager).load('/assets/hd/lighting.hdr', texture => { if (this.disposed) { texture.dispose(); return; } const generator = new THREE.PMREMGenerator(this.renderer); const target = generator.fromEquirectangular(texture); this.environmentTarget?.dispose(); this.environmentTarget = target; this.scene.environment = target.texture; texture.dispose(); generator.dispose(); });
        const raingeo = new THREE.BufferGeometry(), rainpos = new Float32Array(2400); for (let i = 0; i < rainpos.length; i += 3) { rainpos[i] = (Math.random() - .5) * 180; rainpos[i + 1] = Math.random() * 100; rainpos[i + 2] = (Math.random() - .5) * 180; } raingeo.setAttribute('position', new THREE.BufferAttribute(rainpos, 3)); this.rain = new THREE.Points(raingeo, new THREE.PointsMaterial({ color: 0xc4d9e2, size: .16, transparent: true, opacity: .55 })); this.scene.add(this.rain);
        this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 })); this.composer.addPass(new RenderPass(this.scene, this.camera)); this.ao = new SSAOPass(this.scene, this.camera, 800, 600); this.ao.kernelRadius = 3; this.ao.minDistance = .0003; this.ao.maxDistance = .015; this.composer.addPass(this.ao); this.ao.enabled = false; this.bloom = new UnrealBloomPass(new THREE.Vector2(800, 600), .16, .3, .88); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass()); this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container); this.resize(); container.addEventListener('pointerdown', this.pointerDown); container.addEventListener('wheel', this.wheel, { passive: false });
    }
    buildWorld() {
        this.pilotWorld=new PilotWorld(this.scene,this.manager);
        this.scenery = new MorningScenery(this.scene, this.renderer, this.manager);this.obstacles.push(...this.scenery.walkingObstacles); const tarmac = this.scenery.asphalt, concrete = material(0xb3b7a9, .88), paint = material(0xf3f2e8, .8), yellow = material(0xf0c855);
        // Airfields share a training elevation and are intentionally compressed.
        for (const z of [0, -25000]) {
            box(this.scene, 60, .12, 3000, 0, .15, z, tarmac); box(this.scene, 19, .12, 3000, 135, .12, z, tarmac); box(this.scene, 320, .11, 900, 285, .10, z + 300, concrete);
            for (const dz of [-1200, -500, 200, 900]) box(this.scene, 135, .14, 22, 67, .16, z + dz, tarmac);
            for (const x of [-28, 28]) box(this.scene, .55, .02, 2970, x, .23, z, paint);
            for (let dz = -1450; dz < 1500; dz += 100) { box(this.scene, 1, .02, 40, 0, .24, z + dz, paint); for (const x of [-33, 33]) { const light = new THREE.Mesh(new THREE.SphereGeometry(.4, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffe6ac })); light.position.set(x, .65, z + dz); this.scene.add(light); this.lights.push(light); } }
            for (const end of [-1, 1]) { for (const side of [-1, 1]) for (let i = 0; i < 6; i++)box(this.scene, 2.8, .03, 38, side * (6 + i * 3.4), .26, z + end * 1420, paint); box(this.scene, 5, .03, 40, -15, .26, z + end * 1050, paint); box(this.scene, 5, .03, 40, 15, .26, z + end * 1050, paint); }
            const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const cx = cv.getContext('2d')!; cx.fillStyle = '#e2e4d7'; cx.font = 'bold 145px Arial'; cx.textAlign = 'center'; cx.fillText('36', 128, 180); const tex = new THREE.CanvasTexture(cv); const number = new THREE.Mesh(new THREE.PlaneGeometry(26, 30), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); number.rotation.x = -Math.PI / 2; number.position.set(0, .28, z + 1330); this.scene.add(number);
            box(this.scene, .25, .03, 2900, 135, .24, z, yellow);
            for (let i = 0; i < 5; i++) { box(this.scene, 70, 16, 80, 290, 8, z - 500 + i * 155, material(0xb7bcba)); box(this.scene, 73, 2, 83, 290, 16.5, z - 500 + i * 155, material(0x5f717c)); box(this.scene, 4, 4, 85, 253, 5, z - 500 + i * 155, material(0x506a78)); }
            const tower=new ControlTower();tower.group.position.set(200,0,z+1000);this.scene.add(tower.group);this.towers.push(tower);
        }

    }
    resize() {
        const w = this.container.clientWidth, h = this.container.clientHeight; if (!w || !h) return;
        const cap = this.quality === 'Ultra' ? 2 : this.quality === 'High' ? 1.25 : 1;
        const ratio = Math.min(devicePixelRatio, cap, 3840 / w, 2160 / h);
        this.renderer.setPixelRatio(ratio); this.composer.setPixelRatio(ratio);
        this.renderer.setSize(w, h); this.composer.setSize(w, h);
        const aoScale = this.quality === 'Ultra' ? 1 : .6;
        this.ao.setSize(Math.round(w * aoScale), Math.round(h * aoScale));
        this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
    pointerDown = (e: PointerEvent) => { if (this.mode !== 'Free'&&!this.pilot?.active) return; this.stopDrag();const startX = e.clientX, startY = e.clientY, angle = this.freeAngle, height = this.freeHeight,heading=this.pilot?.heading??0,look=this.pilot?.look??0; const move = (ev: PointerEvent) => {if(this.pilot?.active){this.pilot.heading=heading+(ev.clientX-startX)*.004;this.pilot.look=Math.max(-1.15,Math.min(1.15,look-(ev.clientY-startY)*.004));return;} this.freeAngle = angle + (ev.clientX - startX) * .007; this.freeHeight = Math.max(3, Math.min(1200, height + (ev.clientY - startY) * .3)); }; const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);window.removeEventListener('blur',up); };this.stopDrag=up; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);window.addEventListener('blur',up); };
    wheel = (e: WheelEvent) => { if (this.mode !== 'Free') return; e.preventDefault(); this.zoom = Math.max(25, Math.min(2500, this.zoom + e.deltaY * .05)); };
    render(s: FlightState, dt: number) {
        if (this.quality !== this.lastQuality) {
            this.lastQuality = this.quality;
            for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) { target.samples = this.quality === 'Ultra' ? 4 : 0; target.dispose(); }
            this.renderer.shadowMap.enabled = this.quality !== 'Performance'; this.sun.shadow.mapSize.setScalar(this.quality === 'Ultra' ? 4096 : this.quality === 'High' ? 2048 : 1024); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.resize();
        }
        const p = this.plane.group;
        p.position.set(s.x, aircraftBodyHeight(s), s.z);
        p.rotation.set(s.pitch, -s.heading, -s.bank, 'YXZ');
        const inside=!!this.pilot?.active&&this.pilot.zone==='Cabin';this.plane.update(s, dt);this.plane.setCockpitView(inside||!this.pilot?.active&&this.mode==='Cockpit');this.interior.update(s,inside||!this.pilot?.active&&this.mode==='Cockpit');p.updateMatrixWorld(true);
        if(this.pilot?.active){pilotCamera(this.pilot,this.camera,this.target,inside?this.interior.colliders:this.plane.group.children.filter(o=>o.visible&&o!==this.interior.group),inside?[]:this.obstacles);}else {const chase = this.mode === 'Chase'; if (this.mode === 'Cockpit') { this.desired.set(-.73, .60, -16.35); this.desired.applyQuaternion(p.quaternion).add(p.position); this.target.set(-.73, .60, -500).applyQuaternion(p.quaternion).add(p.position); this.camera.position.copy(this.desired); this.camera.up.set(0, 1, 0).applyQuaternion(p.quaternion); } else { const angle = chase ? 0 : this.freeAngle; this.desired.set(Math.sin(angle) * this.zoom, chase ? 23 : this.freeHeight, Math.cos(angle) * this.zoom); this.desired.applyAxisAngle(new THREE.Vector3(0, 1, 0), -s.heading).add(p.position); if (chase) this.camera.position.copy(this.desired); else this.camera.position.lerp(this.desired, 1 - Math.exp(-dt * 3)); this.target.copy(p.position).add(new THREE.Vector3(0, 3, 0)); this.camera.up.set(0, 1, 0); } } const shake=this.effects.update(s,dt,this.container.clientHeight*this.renderer.getPixelRatio());if(shake>0){this.camera.position.x+=Math.sin(this.visualTime*83)*shake;this.camera.position.y+=Math.cos(this.visualTime*97)*shake*.7;}this.camera.lookAt(this.target);
        const elevation = Math.sin((s.time - 6) / 12 * Math.PI); const sunvec = new THREE.Vector3(-.65, Math.max(-.2, elevation), .45).normalize(); this.sky.material.uniforms.sunPosition.value.copy(sunvec); const daylight = Math.max(0, elevation), night=nightAmount(s.time); this.sun.intensity = daylight * 2.5; this.ambient.intensity = .10 + daylight * .96; this.ambient.color.set(night>.5?0x6e8ac2:0xc9e7ff); this.ambient.groundColor.set(night>.5?0x172234:0x839b5e); this.scene.environmentIntensity = .025 + daylight * .685; this.sun.position.copy(p.position).addScaledVector(sunvec, 500); this.sun.target.position.copy(p.position); this.renderer.toneMappingExposure = .62 + daylight * .28;
        const photoDay = this.hdSky !== null && elevation > .15 && s.weather === 'Clear'; this.sky.visible = !photoDay && night<.95; this.scene.background = photoDay ? this.hdSky : null; this.scene.backgroundIntensity = .85;
        const fog = this.scene.fog as THREE.FogExp2; fog.density = s.weather === 'Fog' ? .00065 : s.weather === 'Rain' ? .00016 : s.weather === 'Cloudy' ? .000038 : .000012; fog.color.setHSL(.59, .35, .04 + daylight * .51); this.visualTime += dt; this.scenery.update(this.visualTime, s.time, s.weather, this.camera, sunvec); this.scenery.forest.update(this.camera.position, this.quality); this.scenery.forest.setNight(night); this.night.update(s,this.camera,this.renderer.getPixelRatio());this.towers.forEach(tower=>tower.update(night,this.visualTime)); this.pilotWorld.update(this.visualTime,night,s,!!this.pilot?.active&&this.pilot.zone==='Outside',this.camera,this.pilot,dt); this.rain.visible = s.weather === 'Rain'&&!inside; if (this.rain.visible) { this.rain.position.copy(this.camera.position); const attr = this.rain.geometry.attributes.position; for (let i = 0; i < attr.count; i++) { let y = attr.getY(i) - dt * 55; if (y < 0) y = 100; attr.setY(i, y); } attr.needsUpdate = true; }
        this.bloom.strength = elevation < .1 ? .22 : .02; this.ao.enabled = this.quality === 'Ultra' && this.mode !== 'Cockpit'; if (this.quality !== 'Performance') this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
    }
    dispose() { this.stopDrag();this.disposed = true;this.pilotWorld.dispose();this.interior.dispose(); this.resizeObserver.disconnect(); this.container.removeEventListener('pointerdown', this.pointerDown); this.container.removeEventListener('wheel', this.wheel); this.scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Points) { o.geometry.dispose(); const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => { if ('map' in m) (m.map as THREE.Texture)?.dispose(); m.dispose(); }); } }); this.night.dispose(); this.hdSky?.dispose(); this.scenery.dispose(); this.environmentTarget?.dispose(); this.composer.passes.forEach(p => p.dispose()); this.composer.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
