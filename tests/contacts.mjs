import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import {initialState,step,idleInput,aircraftPointHeight} from '../lib/flight/physics.ts';
function flight(patch){return Object.assign(initialState(),{running:true,phase:'Takeoff',speed:75,turbulence:0},patch);}
const tail=flight({pitch:.3});step(tail,idleInput(),1/60);assert.equal(tail.contact.kind,'tailstrike');assert.equal(tail.phase,'Crashed');const z=tail.z,speed=tail.speed;step(tail,idleInput(),1/60);assert.ok(tail.z<z&&tail.speed<speed&&tail.impactAge>0);
const wing=flight({onGround:false,y:3.2,bank:.5});step(wing,idleInput(),1/60);assert.equal(wing.contact.kind,'wingstrike');
const belly=flight({onGround:false,y:2.81,vs:-1,gear:false});step(belly,idleInput(),1/60);assert.equal(belly.contact.kind,'belly');
const impact=flight({onGround:false,y:2.81,vs:-8});step(impact,idleInput(),1/60);assert.equal(impact.contact.kind,'impact');
const landing=flight({onGround:false,y:2.81,vs:-1});step(landing,idleInput(),1/60);assert.equal(landing.phase,'Rollout');assert.equal(landing.contact.kind,'touchdown');
const field=flight({x:45});step(field,idleInput(),1/60);assert.equal(field.contact.kind,'excursion');assert.equal(field.contact.paved,false);
const idle=initialState();idle.running=true;for(let i=0;i<60;i++)step(idle,idleInput(),1/60);assert.equal(idle.contact,null);
// Holding forward on the runway must load the nose gear, not bury the nose.
for(const speed of [0,40,75]){
 const grounded=flight({speed});
 for(let i=0;i<180;i++)step(grounded,{...idleInput(),pitch:-1},1/60);
 assert.equal(grounded.pitch,0);assert.notEqual(grounded.phase,'Crashed');
 assert.ok(aircraftPointHeight(grounded,0,-3.5,-13)>=.20);
 assert.ok(aircraftPointHeight(grounded,0,-1.04,-18.55)>.23);
}
const airborne=flight({onGround:false,y:100,pitch:0});
for(let i=0;i<60;i++)step(airborne,{...idleInput(),pitch:-1},1/60);
assert.ok(airborne.pitch<-.1,'negative pitch remains available in flight');
const nose=flight({onGround:false,y:4,pitch:-.25,vs:-3});
step(nose,idleInput(),1/60);assert.equal(nose.contact.kind,'nosestrike');assert.equal(nose.phase,'Crashed');
assert.ok(aircraftPointHeight(nose,0,-3.5,-13)>=.229,'impact pose must not bury nose gear');
assert.ok(aircraftPointHeight(nose,0,-1.04,-18.55)>=.229,'impact pose must not bury nose');
let js=ts.transpileModule(fs.readFileSync('lib/flight/effects.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from 'three'",`from '${import.meta.resolve('three')}'`);
const {GroundEffects}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const scene=new THREE.Scene(),effects=new GroundEffects(scene);effects.update(tail,1/60,900);const sparks=scene.children.find(o=>o.isLineSegments),smoke=scene.children.find(o=>o.isPoints);assert.ok(sparks.geometry.drawRange.count>0);assert.ok(smoke.geometry.drawRange.count>0);
const count=sparks.geometry.drawRange.count;tail.paused=true;effects.update(tail,1,900);assert.equal(sparks.geometry.drawRange.count,count);tail.paused=false;tail.speed=0;
for(let i=0;i<300;i++)effects.update(tail,1/60,900);assert.equal(sparks.geometry.drawRange.count,0);assert.equal(smoke.geometry.drawRange.count,0);
effects.reset();effects.update(landing,1/60,900);assert.equal(sparks.geometry.drawRange.count,0,'ordinary landing must not spark');assert.ok(smoke.geometry.drawRange.count>0);
effects.update(initialState(),1/60,900);assert.equal(smoke.geometry.drawRange.count,0);assert.equal(scene.children.find(o=>o.isInstancedMesh).count,0);
console.log('Contact checks passed: tail/wing strikes, belly landing, hard impact, tire smoke, excursion, crash slide, pause, expiry and reset.');
