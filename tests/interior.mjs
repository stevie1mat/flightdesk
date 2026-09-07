import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import {initialState,idleInput,step} from '../lib/flight/physics.ts';
import {initialPilot,leaveAircraft,boardAircraft,standInCabin,nearFlightSeat,sitToFly,exitCabin,cabinLocal,stepPilot,idlePilotInput} from '../lib/flight/pilot.ts';
const flat=()=>0;
for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
 const s=Object.assign(initialState(),{heading}),p=initialPilot();assert.equal(p.view,'Third person');assert.ok(leaveAircraft(p,s));assert.ok(boardAircraft(p,s));assert.equal(p.zone,'Cabin');
 function walkLocal(x,z){let n=0;while(n++<2000){const q=cabinLocal(p,s);if(Math.hypot(q.x-x,q.z-z)<.04)return;p.heading=s.heading+Math.atan2(x-q.x,-(z-q.z));stepPilot(p,{...idlePilotInput(),forward:1},1/60,flat,[],s);}assert.fail(`Blocked walking to ${x}, ${z}`);}
 walkLocal(0,-14.05);walkLocal(0,11.8);assert.ok(cabinLocal(p,s).z>11.7);assert.equal(exitCabin(p,s),false);assert.equal(sitToFly(p,s),false);
 p.heading=s.heading+Math.PI/2;for(let i=0;i<180;i++)stepPilot(p,{...idlePilotInput(),forward:1},1/60,flat,[],s);assert.ok(cabinLocal(p,s).x<=.31,'seats bound the aisle');
 walkLocal(0,11.8);walkLocal(0,-15.5);assert.ok(nearFlightSeat(p,s));assert.ok(sitToFly(p,s));assert.equal(p.active,false);assert.ok(standInCabin(p,s));walkLocal(0,-14.05);assert.ok(exitCabin(p,s));assert.equal(p.zone,'Outside');assert.equal(p.active,true);
}
async function source(file){let js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;js=js.replace(/from '([^']+)'/g,(_,p)=>`from '${import.meta.resolve(p)}'`);return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);}
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const {AircraftInterior}=await source('lib/flight/interior.ts');const parent=new THREE.Group(),interior=new AircraftInterior(parent);interior.update(initialState(),true);parent.updateMatrixWorld(true);assert.ok(interior.colliders.length<15,'interior static surfaces must be batched');assert.ok(interior.group.children.some(o=>o.name==='Live cockpit display'));
const {pilotCamera}=await source('lib/flight/pilot-camera.ts');const p=Object.assign(initialPilot(),{active:true,x:0,y:1.68,z:0}),camera=new THREE.PerspectiveCamera(),target=new THREE.Vector3();pilotCamera(p,camera,target,[],[]);assert.ok(camera.position.z>3,'third-person camera sits behind pilot');
const wall=new THREE.Mesh(new THREE.BoxGeometry(4,4,.1),new THREE.MeshBasicMaterial());wall.position.set(0,1,1.2);wall.updateMatrixWorld();pilotCamera(p,camera,target,[wall],[]);assert.ok(camera.position.z<1.1,'camera must stop before a wall');p.view='First person';pilotCamera(p,camera,target,[],[]);assert.equal(camera.position.y,p.y);assert.equal(camera.position.z,p.z);
console.log('Interior checks passed: entry, aisle collision, full cabin walk, cockpit seat, disembarking at four headings, batched geometry and camera wall clearance.');
