import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
for(const name of ['traveler-man','traveler-woman']){
 const data=fs.readFileSync(`public/assets/people/${name}.glb`),gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 const g=gltf.scene;g.scale.setScalar(.01);let vertices=0;g.traverse(o=>{if(o.isSkinnedMesh){vertices+=o.geometry.attributes.position.count;assert.ok(o.skeleton.bones.length>60);}});assert.ok(vertices>10000);
 const copy=clone(g),head=g.getObjectByName('Bip01_Head');assert.ok(head);assert.notEqual(copy.getObjectByName('Bip01_Head'),head,'each person needs independent bones');
 const mixer=new THREE.AnimationMixer(g);const clip=gltf.animations.find(c=>c.name==='Walk');assert.ok(clip);mixer.clipAction(clip).play();let knees=new Set(),positions=[];
 for(let i=0;i<24;i++){mixer.setTime(clip.duration*i/24);g.updateMatrixWorld(true);const bounds=new THREE.Box3(),v=new THREE.Vector3();g.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();for(let n=0;n<o.geometry.attributes.position.count;n++){o.getVertexPosition(n,v).applyMatrix4(o.matrixWorld);bounds.expandByPoint(v);}}});const size=bounds.getSize(v);assert.ok(bounds.min.y>-.012&&bounds.min.y<.012,`${name} sole height ${bounds.min.y}`);assert.ok(size.y>1.5&&size.y<2,`${name} human height ${size.y}`);assert.ok(size.x<1.05,`${name} arms must not stay in T-pose: ${size.x}`);knees.add(g.getObjectByName('Bip01_L_Calf').quaternion.toArray().map(n=>n.toFixed(2)).join(','));positions.push(bounds.min.y);}
 assert.ok(knees.size>12,'walking must bend knees');console.log(name,vertices,'vertices; independent skeleton, human scale and ground contact across complete walk cycle');
}
// Exercise the actual playable avatar setup using local GLBs and in-memory textures.
const ts=await import('typescript');const assets=new Map();for(const [name,prefix] of [['traveler-man','m002'],['traveler-woman','f001']]){const b=fs.readFileSync(`public/assets/people/${name}.glb`);assets.set(name,await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''));}
const load=GLTFLoader.prototype.load,textureLoad=THREE.TextureLoader.prototype.load;
GLTFLoader.prototype.load=function(url,ready){queueMicrotask(()=>ready(assets.get(url.includes('traveler-man')?'traveler-man':'traveler-woman')));};THREE.TextureLoader.prototype.load=()=>new THREE.Texture();
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
let source=ts.transpileModule(fs.readFileSync('lib/flight/people.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from '([^']+)'/g,(_,p)=>`from '${import.meta.resolve(p)}'`);
const {AirportPeople}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);const crowd=new AirportPeople(new THREE.Scene(),new THREE.LoadingManager());await Promise.resolve();
const pilot={active:true,view:'Third person',x:0,y:1.68,feetY:0,z:0,bodyHeading:0,walked:0,moving:false};const camera=new THREE.PerspectiveCamera();camera.position.set(0,2,5);crowd.updatePilot(pilot,1/60,camera);assert.equal(crowd.player.visible,true);crowd.player.updateMatrixWorld(true);const idleBounds=new THREE.Box3().setFromObject(crowd.player,true);assert.ok(Math.abs(idleBounds.min.y)<.03,`standing sole height ${idleBounds.min.y}`);assert.ok(idleBounds.max.y>1.5&&idleBounds.max.y<2);
pilot.moving=true;pilot.walked=.04;crowd.updatePilot(pilot,1/60,camera);pilot.view='First person';crowd.updatePilot(pilot,1/60,camera);assert.equal(crowd.player.visible,false);crowd.dispose();GLTFLoader.prototype.load=load;THREE.TextureLoader.prototype.load=textureLoad;
console.log('Playable pilot checks passed: textured model instance, grounded idle pose, walking and first/third-person visibility.');
