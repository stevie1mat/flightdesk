import type {FlightState} from './physics';
export type PilotInput={forward:number;right:number;turn:number;look:number;sprint:boolean};
export type Obstacle={x:number;z:number;w:number;d:number};
export const initialPilot=()=>({active:false,zone:'Outside' as 'Outside'|'Cabin',view:'Third person' as 'Third person'|'First person',x:0,z:0,y:1.68,feetY:0,heading:0,bodyHeading:0,look:0,walked:0,stride:0,moving:false,airport:0});
export type PilotState=ReturnType<typeof initialPilot>;
export const idlePilotInput=():PilotInput=>({forward:0,right:0,turn:0,look:0,sprint:false});
export function exitReason(s:FlightState){return s.phase==='Crashed'?'Restart after an accident.':!s.onGround?'Land before leaving the aircraft.':s.speed>.5?'Stop the aircraft first.':s.throttle>.01?'Bring the throttle to idle first.':s.gearPosition<.95?'Lower the landing gear first.':'';}
export function boardingPoint(s:FlightState){const x=-5.5,z=-13;return{x:s.x+x*Math.cos(s.heading)-z*Math.sin(s.heading),z:s.z+x*Math.sin(s.heading)+z*Math.cos(s.heading)};}
export function leaveAircraft(p:PilotState,s:FlightState){if(exitReason(s))return false;Object.assign(p,boardingPoint(s),{active:true,zone:'Outside',feetY:0,y:1.68,heading:s.heading-Math.PI/2,look:0,moving:false,airport:s.z<-12500?-25000:0});p.bodyHeading=p.heading;s.pitch=0;s.bank=0;s.brake=true;s.assist=false;s.ap=false;s.paused=false;s.controlPitch=s.controlRoll=s.controlYaw=0;return true;}
export function canBoard(p:PilotState,s:FlightState){const door=boardingPoint(s);return p.active&&p.zone==='Outside'&&Math.hypot(p.x-door.x,p.z-door.z)<5;}
export function cabinLocal(p:PilotState,s:FlightState){const x=p.x-s.x,z=p.z-s.z;return{x:x*Math.cos(s.heading)+z*Math.sin(s.heading),z:-x*Math.sin(s.heading)+z*Math.cos(s.heading)};}
function placeInside(p:PilotState,s:FlightState,x:number,z:number){p.zone='Cabin';p.active=true;p.x=s.x+x*Math.cos(s.heading)-z*Math.sin(s.heading);p.z=s.z+x*Math.sin(s.heading)+z*Math.cos(s.heading);p.feetY=s.y-.19;p.y=p.feetY+1.68;p.heading=s.heading;p.bodyHeading=p.heading;p.look=0;p.moving=false;}
export function boardAircraft(p:PilotState,s:FlightState){if(!canBoard(p,s))return false;placeInside(p,s,-.65,-14.05);return true;}
export function standInCabin(p:PilotState,s:FlightState){if(exitReason(s))return false;s.pitch=0;s.bank=0;s.brake=true;s.ap=false;s.assist=false;s.paused=false;placeInside(p,s,0,-15.25);return true;}
export function nearFlightSeat(p:PilotState,s:FlightState){return p.active&&p.zone==='Cabin'&&cabinLocal(p,s).z<-15.35;}
export function nearCabinExit(p:PilotState,s:FlightState){const q=cabinLocal(p,s);return p.active&&p.zone==='Cabin'&&Math.abs(q.z+14.05)<.7;}
export function sitToFly(p:PilotState,s:FlightState){if(!nearFlightSeat(p,s))return false;p.active=false;p.moving=false;s.brake=false;return true;}
export function exitCabin(p:PilotState,s:FlightState){if(!nearCabinExit(p,s))return false;return leaveAircraft(p,s);}
export function cabinWalkable(x:number,z:number){return z>=-15.70&&z<=12.55&&Math.abs(x)<(z<-15?.30:z<-13.2?1.0:.30);}

export function loungePoint(p:PilotState){return{x:90,z:p.airport+1100};}
export function inLounge(p:PilotState){const q=loungePoint(p);return p.zone==='Outside'&&Math.abs(p.x-q.x)<10&&Math.abs(p.z-q.z)<7;}
export function airportObstacles(){const result:Obstacle[]=[];for(const a of [0,-25000]){for(let i=0;i<5;i++)result.push({x:290,z:a-500+i*155,w:76,d:86});result.push({x:200,z:a+1000,w:40,d:40});result.push({x:90,z:a+1092,w:24,d:.5},{x:78,z:a+1100,w:.5,d:16},{x:102,z:a+1100,w:.5,d:16},{x:82,z:a+1108,w:8,d:.5},{x:98,z:a+1108,w:8,d:.5});}return result;}
export function stepPilot(p:PilotState,i:PilotInput,dt:number,ground:(x:number,z:number)=>number|null,obstacles:Obstacle[],aircraft:FlightState){
 if(!p.active)return;dt=Math.min(dt,.04);p.heading+=i.turn*dt*1.9;p.look=Math.max(-1.15,Math.min(1.15,p.look+i.look*dt));
 const norm=Math.max(1,Math.hypot(i.forward,i.right)),speed=p.zone==='Cabin'?1.25:i.sprint?7:2.8;
 const dx=(Math.sin(p.heading)*i.forward+Math.cos(p.heading)*i.right)/norm*speed*dt,dz=(-Math.cos(p.heading)*i.forward+Math.sin(p.heading)*i.right)/norm*speed*dt;
 const valid=(x:number,z:number)=>{if(p.zone==='Cabin'){const q=cabinLocal({...p,x,z},aircraft);return cabinWalkable(q.x,q.z);}if(ground(x,z)===null)return false;if(obstacles.some(b=>Math.abs(x-b.x)<b.w/2+.4&&Math.abs(z-b.z)<b.d/2+.4))return false;const rx=x-aircraft.x,rz=z-aircraft.z,lx=rx*Math.cos(aircraft.heading)+rz*Math.sin(aircraft.heading),lz=-rx*Math.sin(aircraft.heading)+rz*Math.cos(aircraft.heading);return !(Math.abs(lx)<2.5&&lz>-19.8&&lz<19.8);};
 const beforeX=p.x,beforeZ=p.z;if(valid(p.x+dx,p.z))p.x+=dx;if(valid(p.x,p.z+dz))p.z+=dz;
 const distance=Math.hypot(p.x-beforeX,p.z-beforeZ);p.walked+=distance;p.stride+=distance*2.4;p.moving=distance>.001;if(p.moving)p.bodyHeading=Math.atan2(p.x-beforeX,-(p.z-beforeZ));p.feetY=p.zone==='Cabin'?aircraft.y-.19:(ground(p.x,p.z)??0);p.y=p.feetY+1.68+(p.moving&&p.view==='First person'?Math.sin(p.stride)*.025:0);
}
