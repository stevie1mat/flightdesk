import * as THREE from 'three';
import { nightAmount } from './night';
import { loadSurface } from './hd-materials';
import { DetailedForest, type TreePosition } from './forest';

// Deterministic scenery, shared by both training airfields. Distances in metres.
export function randomSource(seed = 137) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
export const coastline = (z: number) => 1400 + Math.sin(z * .00043) * 270 + Math.sin(z * .0011) * 120;
export function islandWidth(z: number) { const d = Math.min(Math.abs(z), Math.abs(z + 25000)); return d < 1950 ? 590 * Math.pow(Math.max(0, 1 - Math.pow(d / 1980, 6)), .25) : 0; }
export function isLand(x: number, z: number) { return x > coastline(z) || Math.abs(x) < islandWidth(z) || x < -8200 + Math.sin(z * .0003) * 450; }
const noise = (x: number, z: number) => Math.sin(x * .00027 + Math.sin(z * .00021)) * Math.cos(z * .00031) * .5 + Math.sin(x * .00072 + z * .00038) * .23 + Math.cos(x * .0019 - z * .0012) * .09;
export function groundHeight(x: number, z: number) { const mainland = Math.max(0, x - 5500) / 11000; const western = Math.max(0, -x - 9000) / 9000; return Math.max(0, (noise(x, z) + .62) * Math.max(mainland, western) * 850); }
function texture(kind: 'grass' | 'asphalt' | 'windows') {
  const c = document.createElement('canvas'); c.width = c.height = kind === 'windows' ? 128 : 512; const ctx = c.getContext('2d')!; const rand = randomSource(kind === 'grass' ? 384 : 782);
  if (kind === 'windows') { ctx.fillStyle = '#9aacb4'; ctx.fillRect(0, 0, 128, 128); for (let x = 0; x < 128; x += 16)for (let y = 0; y < 128; y += 16) { ctx.fillStyle = rand() > .3 ? `hsl(204 24% ${27 + rand() * 30}%)` : '#c0ced0'; ctx.fillRect(x + 3, y + 3, 10, 11); ctx.fillStyle = '#becbcc'; ctx.fillRect(x + 3, y + 3, 10, 1); } }
  else { const im = ctx.createImageData(512, 512); for (let y = 0; y < 512; y++)for (let x = 0; x < 512; x++) { const i = (y * 512 + x) * 4; const n = rand() * .25 + Math.sin(x * .10) * Math.cos(y * .074) * .1 + Math.sin(x * .028 + y * .019) * .08; const base = kind === 'grass' ? [101, 137, 55] : [82, 89, 91]; for (let k = 0; k < 3; k++)im.data[i + k] = base[k] * (.82 + n); im.data[i + 3] = 255; } ctx.putImageData(im, 0, 0); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8; return map;
}
export function grassMaterial() { const map = texture('grass'); map.repeat.set(140, 140); return new THREE.MeshStandardMaterial({ color: 0xc1d694, map, roughness: .98, side: THREE.DoubleSide }); }
export function runwayMaterial() { const map = texture('asphalt'); map.repeat.set(3, 120); return new THREE.MeshStandardMaterial({ map, roughness: .95, color: 0xb0b6b4 }); }
const waterVertex = `varying vec3 vWorld; void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
const waterFragment = `
 uniform sampler2D skyMap; uniform bool hasSky;
 uniform float time; uniform float daylight; uniform vec3 sunDirection; uniform vec3 eye;
 varying vec3 vWorld;
 void main(){
 vec2 p=vWorld.xz;float t=time;
 vec2 slope=vec2(sin(p.x*.041+p.y*.024+t*.8)*.045+sin(p.x*.11-p.y*.07+t*1.4)*.017,cos(p.y*.035-p.x*.028+t*.55)*.04+cos(p.y*.13+p.x*.053+t)*.013);
 vec3 n=normalize(vec3(slope.x,1.,slope.y));vec3 view=normalize(eye-vWorld);
 float fresnel=pow(1.-max(dot(n,view),0.),4.);
 vec3 sea=mix(vec3(.025,.23,.28),vec3(.16,.40,.51),fresnel*.85);
 if(hasSky){vec3 reflection=reflect(-view,n);vec2 skyUV=vec2(atan(reflection.z,reflection.x)*.15915494+.5,asin(clamp(reflection.y,-1.,1.))*.31830989+.5);vec3 reflectedSky=texture2D(skyMap,skyUV).rgb;sea=mix(sea,reflectedSky,.1+fresnel*.62);}
 float glint=pow(max(dot(reflect(-sunDirection,n),view),0.),170.);
 sea+=vec3(1.,.90,.70)*glint*.8;
 sea+=(sin(p.x*.012+p.y*.036+t*.2)*.5+.5)*.014;
 sea*=.035+daylight*1.155;
 float distanceFog=1.-exp(-length(eye-vWorld)*.000019);
 sea=mix(sea,vec3(.62,.77,.84)*(.025+daylight*.975),distanceFog);
 gl_FragColor=vec4(sea,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
const cloudVertex = `varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const cloudFragment = `
 uniform float time;uniform float coverage;uniform float daylight;uniform vec3 eye;varying vec3 vWorld;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
 float fbm(vec2 p){float a=.5,n=0.;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.03+19.1;a*=.5;}return n;}
 void main(){vec2 uv=vWorld.xz*.00042+vec2(time*.0015,time*.00035);float n=fbm(uv);float cloud=smoothstep(coverage,coverage+.16,n);float rim=fbm(uv+vec2(.2,-.17));vec3 color=mix(vec3(.61,.70,.76),vec3(1.,.99,.96),smoothstep(.25,.65,rim));color*=.025+1.015*daylight;float distanceFade=1.-smoothstep(22000.,51000.,length(vWorld.xz-eye.xz));gl_FragColor=vec4(color,cloud*.91*distanceFade);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
export class MorningScenery {
  walkingObstacles:{x:number;z:number;w:number;d:number}[]=[];
  cityMaterial: THREE.MeshStandardMaterial | null=null; water: THREE.Mesh; clouds: THREE.Mesh; waterMaterial: THREE.ShaderMaterial; cloudMaterial: THREE.ShaderMaterial; grass: THREE.MeshStandardMaterial; asphalt: THREE.MeshStandardMaterial; forest: DetailedForest;
  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, manager: THREE.LoadingManager) {
    this.grass = loadSurface('grass', manager); this.asphalt = loadSurface('asphalt', manager);
    const rand = randomSource();
    this.waterMaterial = new THREE.ShaderMaterial({ vertexShader: waterVertex, fragmentShader: waterFragment, uniforms: { skyMap: { value: null }, hasSky: { value: false }, time: { value: 0 }, daylight: { value: 1 }, sunDirection: { value: new THREE.Vector3() }, eye: { value: new THREE.Vector3() } } }); this.water = new THREE.Mesh(new THREE.PlaneGeometry(120000, 120000), this.waterMaterial); this.water.rotation.x = -Math.PI / 2; this.water.position.y = -4; scene.add(this.water);
    const cloudGeometry = new THREE.PlaneGeometry(110000, 110000); cloudGeometry.rotateX(Math.PI / 2); this.cloudMaterial = new THREE.ShaderMaterial({ vertexShader: cloudVertex, fragmentShader: cloudFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { time: { value: 0 }, coverage: { value: .47 }, daylight: { value: 1 }, eye: { value: new THREE.Vector3() } } }); this.clouds = new THREE.Mesh(cloudGeometry, this.cloudMaterial); this.clouds.position.set(0, 2200, -15000); this.clouds.renderOrder = 3; scene.add(this.clouds);
    // A continuous curved coast replaces the old rectangular ground slab.
    for (const western of [false, true]) { const g = new THREE.PlaneGeometry(western ? 15500 : 26000, 75000, 90, 190); g.rotateX(-Math.PI / 2); const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const u = pos.getX(i), z = pos.getZ(i) - 18000; const x = western ? -8200 + Math.sin(z * .0003) * 450 - (u + 7750) : coastline(z) + (u + 13000); pos.setXYZ(i, x, groundHeight(x, z) - .15, z); } g.computeVertexNormals(); const land = new THREE.Mesh(g, this.grass); land.receiveShadow = true; scene.add(land); }
    // Rounded reclaimed airfield islands with a pale rocky seawall.
    for (const center of [0, -25000]) {
      for (const shore of [true, false]) { const shape = new THREE.Shape(); for (let i = 0; i <= 160; i++) { const t = i / 160 * Math.PI * 2; const x = Math.sign(Math.cos(t)) * Math.pow(Math.abs(Math.cos(t)), .55) * (shore ? 613 : 592); const z = Math.sign(Math.sin(t)) * Math.pow(Math.abs(Math.sin(t)), .55) * (shore ? 1975 : 1950) + center; if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z); } const g = new THREE.ShapeGeometry(shape, 48); g.rotateX(Math.PI / 2); const uv = g.attributes.uv; for (let j = 0; j < uv.count; j++)uv.setXY(j, (uv.getX(j) + 650) / 1300, (uv.getY(j) - center + 2000) / 4000); const land = new THREE.Mesh(g, shore ? new THREE.MeshStandardMaterial({ color: 0xa9ad91, roughness: 1, side: THREE.DoubleSide }) : this.grass); land.position.y = shore ? -1.1 : 0; land.receiveShadow = true; scene.add(land); }
      // Causeway, service road, and marina on the inland side.
      const roadMat = new THREE.MeshStandardMaterial({ color: 0x666e6a, roughness: .95 }); const road = new THREE.Mesh(new THREE.BoxGeometry(1300, 2, 19), roadMat); road.position.set(1040, 1, center + 820); road.receiveShadow = true; scene.add(road);
      for (let j = 0; j < 8; j++) { const pier = new THREE.Mesh(new THREE.BoxGeometry(130, 2, 6), new THREE.MeshStandardMaterial({ color: 0xb8ad8e })); pier.position.set(610, -1, center - 1000 + j * 55); scene.add(pier); }
    }
    const treePositions: TreePosition[] = []; let attempt = 0;
    while (treePositions.length < 4800 && attempt++ < 90000) {
      const i = treePositions.length; let x: number, z: number;
      if (i < 1800) { const airport = i % 2 === 0 ? 0 : -25000; x = (rand() > .5 ? 1 : -1) * (230 + rand() * 340); z = airport + (rand() - .5) * 3500; }
      else { x = rand() * 16500 - 2300; z = 4000 - rand() * 38000; }
      if (!isLand(x, z)) continue;
      const fieldDistance = Math.min(Math.abs(z), Math.abs(z + 25000));
      if (fieldDistance < 1950 && (Math.abs(x) < 210 || x > 100 && x < 470 && fieldDistance < 1300)) continue;
      if (x > 600 && x < 6500 && Math.abs((x - 1500) % 330) < 105) continue;
      treePositions.push({ x, y: groundHeight(x, z), z, height: 12 + rand() * 16, rotation: rand() * Math.PI * 2 });
    }
    this.forest = new DetailedForest(scene, treePositions, renderer, manager);
    const dummy = new THREE.Object3D();
    // Structured city blocks: varied rooflines, window facades, and real streets.
    dummy.rotation.set(0, 0, 0); const facade = texture('windows'); facade.repeat.set(2, 5); const cityMat = new THREE.MeshStandardMaterial({ color: 0xdbe3e5, map: facade, roughness: .48, metalness: .12 }); this.cityMaterial=cityMat; const nightCanvas=document.createElement('canvas');nightCanvas.width=nightCanvas.height=128;const nc=nightCanvas.getContext('2d')!;nc.fillStyle='#000';nc.fillRect(0,0,128,128);for(let x=0;x<128;x+=16)for(let y=0;y<128;y+=16){if(rand()>.38){nc.fillStyle=rand()>.3?'#ffc879':'#c5daef';nc.fillRect(x+3,y+3,10,11);}}const nightMap=new THREE.CanvasTexture(nightCanvas);nightMap.colorSpace=THREE.SRGBColorSpace;nightMap.wrapS=nightMap.wrapT=THREE.RepeatWrapping;nightMap.repeat.copy(facade.repeat);cityMat.emissiveMap=nightMap;cityMat.emissive.set(0xffffff);cityMat.emissiveIntensity=0; const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityMat, 1800); const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x8d9b9e, roughness: .85 }), 1800); let building = 0;
    for (let row = 0; row < 110; row++)for (let col = 0; col < 16; col++) { const x = 1800 + col * 310 + (rand() - .5) * 90, z = 3300 - row * 310; if (x < coastline(z) + 120 || rand() < .14) continue; const downtown = Math.exp(-Math.pow((z + 3500) / 2300, 2)) * Math.exp(-Math.pow((x - 3300) / 1700, 2)); const h = 12 + rand() * 35 + Math.pow(rand(), 1.2) * downtown * 350; const w = 45 + rand() * 75, d = 45 + rand() * 80; this.walkingObstacles.push({x,z,w,d}); dummy.position.set(x, h / 2 + groundHeight(x, z), z); dummy.scale.set(w, h, d); dummy.updateMatrix(); buildings.setMatrixAt(building, dummy.matrix); buildings.setColorAt(building, new THREE.Color().setHSL(.53 + rand() * .07, .05 + rand() * .08, .55 + rand() * .35)); dummy.position.y += h / 2 + 2; dummy.scale.set(w * .65, 4 + rand() * 6, d * .6); dummy.updateMatrix(); roofs.setMatrixAt(building, dummy.matrix); building++; } buildings.count = roofs.count = building; buildings.receiveShadow = true; scene.add(buildings, roofs);
    const streetMat = new THREE.MeshStandardMaterial({ color: 0x64716c, roughness: .9 }); for (let i = 1; i < 17; i++) { const street = new THREE.Mesh(new THREE.PlaneGeometry(16, 35000), streetMat); street.rotation.x = -Math.PI / 2; street.position.set(1645 + i * 310, .1, -13000); scene.add(street); } for (let i = 0; i < 110; i++) { const street = new THREE.Mesh(new THREE.PlaneGeometry(4800, 13), streetMat); street.rotation.x = -Math.PI / 2; street.position.set(4270, .1, 3455 - i * 310); scene.add(street); }
    // A slender landmark tower breaks the otherwise varied city silhouette.
    const tower = new THREE.Group(); const towerMat = new THREE.MeshStandardMaterial({ color: 0xa0b9c6, roughness: .28, metalness: .5 }); const stem = new THREE.Mesh(new THREE.CylinderGeometry(17, 30, 340, 8), towerMat); stem.position.y = 170; tower.add(stem); const spire = new THREE.Mesh(new THREE.ConeGeometry(5, 100, 8), towerMat); spire.position.y = 390; tower.add(spire); tower.position.set(2900, 0, -3200); scene.add(tower);

  }
  update(time: number, localHour: number, weather: string, camera: THREE.Camera, sun: THREE.Vector3) { const daylight = Math.max(.015, Math.sin((localHour - 6) / 12 * Math.PI));const night=nightAmount(localHour);if(this.cityMaterial)this.cityMaterial.emissiveIntensity=night*1.8;this.waterMaterial.uniforms.hasSky.value=night<.5&&!!this.waterMaterial.uniforms.skyMap.value; this.waterMaterial.uniforms.time.value = time; this.waterMaterial.uniforms.daylight.value = daylight; this.waterMaterial.uniforms.sunDirection.value.copy(sun); this.waterMaterial.uniforms.eye.value.copy(camera.position); this.cloudMaterial.uniforms.time.value = time; this.cloudMaterial.uniforms.daylight.value = daylight; this.cloudMaterial.uniforms.coverage.value = weather === 'Clear' ? .47 : weather === 'Cloudy' ? .32 : .23; this.cloudMaterial.uniforms.eye.value.copy(camera.position); this.clouds.visible = weather === 'Cloudy' || weather === 'Rain'; }
  dispose() { this.cityMaterial?.emissiveMap?.dispose(); this.forest.dispose(); for (const mat of [this.grass, this.asphalt]) { mat.map?.dispose(); mat.normalMap?.dispose(); mat.roughnessMap?.dispose(); } }
}
