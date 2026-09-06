import assert from 'node:assert/strict';
import {initialState,step,idleInput,KT,FT} from '../lib/flight/physics.ts';
function fly(plan=0,weather='Clear',wind=0){const s=initialState(plan);s.running=true;s.assist=true;s.weather=weather;s.wind=wind;const phases=new Set();let previous='';for(let n=0;n<60*1200;n++){step(s,idleInput(),1/60);phases.add(s.phase);if(s.phase!==previous){console.log(s.phase,Math.round(s.elapsed),Math.round(s.speed*KT)+'kt',Math.round(s.y*FT)+'ft','z',Math.round(s.z),'x',Math.round(s.x),'pitch',s.pitch.toFixed(2));previous=s.phase;}if(['Complete','Crashed'].includes(s.phase))break;assert.ok(Number.isFinite(s.y)&&Number.isFinite(s.speed));}console.log('RESULT',s.phase,s.crashReason,s.touchdown);return{s,phases};}
const {s,phases}=fly();assert.equal(s.phase,'Complete');for(const phase of ['Takeoff','Climb','Cruise','Approach','Landing','Rollout','Complete'])assert.ok(phases.has(phase),phase);assert.ok(s.touchdown.noseTime>s.touchdown.mainTime);assert.ok(s.touchdown.rate<600);assert.equal(s.onGround,true);
const parked=initialState();parked.running=true;for(let i=0;i<600;i++)step(parked,idleInput(),1/60);assert.equal(parked.speed,0);assert.equal(parked.y,2.8);
const paused=initialState();paused.running=true;paused.paused=true;paused.throttle=1;step(paused,idleInput(),1/60);assert.equal(paused.elapsed,0);
for(const plan of [1]){assert.equal(fly(plan).s.phase,'Complete');}
for(const weather of ['Rain','Fog'])assert.equal(fly(0,weather,2).s.phase,'Complete');
console.log('Physics integration checks passed');
const gearUp=initialState();Object.assign(gearUp,{running:true,onGround:false,gear:false,y:2.81,vs:-1,speed:70,z:-24000});step(gearUp,idleInput(),1/60);assert.equal(gearUp.phase,'Crashed');assert.match(gearUp.crashReason,/gear/);
const field=initialState();Object.assign(field,{running:true,onGround:false,y:2.81,vs:-1,speed:70,x:500,z:-24000});step(field,idleInput(),1/60);assert.equal(field.phase,'Crashed');
const stall=initialState();Object.assign(stall,{running:true,onGround:false,y:1000,speed:40,pitch:.35});step(stall,idleInput(),1/60);assert.equal(stall.stall,true);
const reverse=initialState();Object.assign(reverse,{running:true,speed:30,n1:100,throttle:1,reverse:true});const forward={...reverse,reverse:false};step(reverse,idleInput(),1/60);step(forward,idleInput(),1/60);assert.ok(reverse.speed<forward.speed);
console.log('Failure-path and control checks passed');
