import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import {initialState} from '../lib/flight/physics.ts';
import {initialPilot,leaveAircraft,standInCabin,stepPilot,idlePilotInput} from '../lib/flight/pilot.ts';
let js=ts.transpileModule(fs.readFileSync('lib/flight/walking-surfaces.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from 'three'",`from '${import.meta.resolve('three')}'`);
const {WalkingSurfaces}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const root=new THREE.Group();function pavement(parent,w,h,d,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d));m.position.set(x,y,z);m.userData.walkingSurface=true;parent.add(m);}
for(const z of [0,-25000]){pavement(root,60,.12,3000,0,.15,z);pavement(root,19,.12,3000,135,.12,z);pavement(root,320,.11,900,285,.10,z+300);pavement(root,1300,2,19,1040,1,z+820);pavement(root,5,.03,40,15,.26,z+1050);const lounge=new THREE.Group();lounge.position.set(90,0,z+1100);root.add(lounge);pavement(lounge,34,.12,27,0,.08,0);pavement(lounge,42,.07,3,-34,.04,10);}
const floors=new WalkingSurfaces();floors.collect(root);const near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} != ${b}`);
for(const z of [0,-25000]){near(floors.height(0,z,0),.218);near(floors.height(135,z,0),.188);near(floors.height(285,z+300,0),.163);near(floors.height(15,z+1050,0),.283);near(floors.height(90,z+1100,0),.148);near(floors.height(50,z+1110,0),.083);near(floors.height(1040,z+820,null),2.008);}
assert.equal(floors.height(1000,2000,null),null);near(floors.height(-100,0,0),.008);
const s=initialState(),p=initialPilot();leaveAircraft(p,s);const ground=(x,z)=>floors.height(x,z,0);
stepPilot(p,idlePilotInput(),1/60,ground,[],s);near(p.feetY,.218);near(p.y,p.feetY+1.68);
p.heading=-Math.PI/2;for(let i=0;i<800;i++)stepPilot(p,{...idlePilotInput(),forward:1},1/60,ground,[],s);assert.ok(p.x<-30.3);near(p.feetY,.008);
p.heading=Math.PI/2;for(let i=0;i<600;i++)stepPilot(p,{...idlePilotInput(),forward:1},1/60,ground,[],s);near(p.feetY,.218);
standInCabin(p,s);stepPilot(p,idlePilotInput(),1/60,ground,[],s);near(p.feetY,s.y-.19);
console.log('Surface checks passed: runway, markings, taxiway, apron, lounge, path, bridge, idle placement, grass/pavement transitions and unchanged cabin floor.');
