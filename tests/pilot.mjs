import assert from 'node:assert/strict';
import {initialState,step,idleInput} from '../lib/flight/physics.ts';
import {initialPilot,leaveAircraft,boardAircraft,canBoard,boardingPoint,exitReason,stepPilot,idlePilotInput,airportObstacles,inLounge,standInCabin,sitToFly,exitCabin,nearFlightSeat,cabinLocal} from '../lib/flight/pilot.ts';
const s=initialState(),p=initialPilot(),obstacles=airportObstacles(),flat=()=>0;
for(const patch of [{onGround:false},{speed:10},{throttle:.5},{gearPosition:0},{phase:'Crashed'}]){const flight=Object.assign(initialState(),patch);assert.ok(exitReason(flight));assert.equal(leaveAircraft(initialPilot(),flight),false);}
assert.ok(leaveAircraft(p,s));assert.equal(s.brake,true);assert.ok(canBoard(p,s));
function walkTo(x,z){let n=0;while(Math.hypot(p.x-x,p.z-z)>.2&&n++<3000){p.heading=Math.atan2(x-p.x,-(z-p.z));stepPilot(p,{...idlePilotInput(),forward:1,sprint:true},1/60,flat,obstacles,s);}assert.ok(n<3000,`walking route blocked at ${p.x}, ${p.z} toward ${x}, ${z}`);}
for(const [x,z] of [[-8,1075],[60,1075],[65,1113],[90,1113],[90,1100]])walkTo(x,z);
assert.ok(inLounge(p));assert.equal(canBoard(p,s),false);assert.equal(boardAircraft(p,s),false);
for(const [x,z] of [[90,1113],[65,1113],[60,1075],[-8,1075],[-5.5,1087]])walkTo(x,z);
assert.ok(boardAircraft(p,s));assert.equal(p.zone,'Cabin');assert.equal(p.active,true);assert.ok(exitCabin(p,s));assert.ok(standInCabin(p,s));p.z-=.25;assert.ok(sitToFly(p,s));assert.equal(p.active,false);assert.equal(s.brake,false);assert.ok(p.walked>200);
s.running=true;for(let i=0;i<240;i++)step(s,{...idleInput(),throttle:1},1/60);assert.ok(s.throttle>.8);assert.ok(s.speed>0,'flight can resume after boarding');
for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){const arrival=Object.assign(initialState(),{z:-24215,phase:'Complete',heading});const crew=initialPilot();assert.ok(leaveAircraft(crew,arrival));assert.equal(crew.airport,-25000);assert.deepEqual({x:crew.x,z:crew.z},boardingPoint(arrival));assert.ok(boardAircraft(crew,arrival));}
function advance(i){const q=Object.assign(initialPilot(),{active:true,x:-100,z:1000});for(let n=0;n<60;n++)stepPilot(q,i,1/60,flat,[],initialState());return q;}
const straight=advance({...idlePilotInput(),forward:1}),diagonal=advance({...idlePilotInput(),forward:1,right:1}),run=advance({...idlePilotInput(),forward:1,sprint:true});assert.ok(Math.abs(straight.walked-diagonal.walked)<.001);assert.ok(run.walked>straight.walked*2);
const blocked=Object.assign(initialPilot(),{active:true,x:75,z:1100,heading:Math.PI/2});for(let n=0;n<120;n++)stepPilot(blocked,{...idlePilotInput(),forward:1},1/60,flat,obstacles,initialState());assert.ok(blocked.x<78,'lounge wall blocks movement');
const shore=Object.assign(initialPilot(),{active:true,x:-100,z:1000,heading:Math.PI/2});for(let n=0;n<120;n++)stepPilot(shore,{...idlePilotInput(),forward:1},1/60,(x)=>x<-98?0:null,[],initialState());assert.ok(shore.x<-98,'cannot walk into water');
console.log('Pilot checks passed: safe exit, walking to lounge and back, boarding at both airports, resumed flight, wall/water collision, normalized movement and sprint.');
