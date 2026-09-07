// SI units internally; a deliberately compressed, fictional training route.
export const DEG = Math.PI / 180;
export const KT = 1.94384;
export const FT = 3.28084;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const wrap = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));
export const FLAPS = [0, 5, 15, 30];
export const PLANS = [
 {name:'Sound corridor', description:'Direct · 14 NM · ~5 min', points:[{name:'SOUND',x:0,z:-6500},{name:'HARBOR',x:0,z:-13000},{name:'PAE36',x:0,z:-20000}]},
 {name:'Coastal departure', description:'Scenic · 15 NM · ~6 min', points:[{name:'COAST',x:-2400,z:-6000},{name:'HARBOR',x:-1800,z:-11000},{name:'PAE36',x:0,z:-19000}]}
];
export type ContactKind='touchdown'|'nosewheel'|'nosestrike'|'tailstrike'|'wingstrike'|'belly'|'impact'|'excursion';
export type ContactEvent={id:number;kind:ContactKind;x:number;y:number;z:number;speed:number;severity:number;paved:boolean};
export type Phase = 'Preflight'|'Takeoff'|'Climb'|'Cruise'|'Approach'|'Landing'|'Rollout'|'Complete'|'Crashed';
export type FlightState = ReturnType<typeof initialState>;
export function initialState(plan=0) {
 return {contact:null as ContactEvent|null,contactSequence:0,impactAge:0,x:0,y:2.8,z:1100,speed:0,vs:0,pitch:0,bank:0,heading:0,controlPitch:0,controlRoll:0,controlYaw:0,throttle:0,n1:20,flaps:1,gear:true,gearPosition:1,brake:false,reverse:false,onGround:true,noseDown:true,phase:'Preflight' as Phase,elapsed:0,running:false,paused:false,ap:false,altHold:false,hdgHold:false,approach:false,assist:false,targetAlt:2500,targetHeading:0,waypoint:0,plan,weather:'Clear',time:9.4,cycle:false,turbulence:0.3,wind:0,stall:false,warning:'',touchdown:null as null|{rate:number,offset:number,score:number,mainTime:number,noseTime:number|null},distance:0,eta:0,localizer:0,glideslope:0,gamepad:false,crashReason:'',fps:60};
}
export type Input = {pitch:number;roll:number;yaw:number;throttle:number;brake:boolean};
export const idleInput = ():Input => ({pitch:0,roll:0,yaw:0,throttle:0,brake:false});
// Shared with rendering: the datum follows the main gear during rotation.
export function aircraftBodyHeight(s:FlightState){
 let y=s.y+.91+s.gearPosition*(3.2*Math.sin(s.pitch)+3.5*(Math.cos(s.pitch)-1));
 if(s.phase==='Crashed'){
  if(s.contact?.kind==='belly')y-=1.65*(1-Math.exp(-s.impactAge*4));
  // Keep the frozen impact pose above the surface while the wreck slides.
  const skin=[[0,-.20,-19.735],[0,-1.04,-18.55],[0,-1.8,-16.45],[0,-1.95,-12],[0,-1.95,9.9],[0,-1.04,15],[0,-.17,17.5],[-16.6,.33,4.48],[16.6,.33,4.48],[-5.05,-2.54,-6.5],[5.05,-2.54,-6.5]];
  if(s.gearPosition>.9)skin.push([0,-3.5,-13],[-3.17,-3.5,3.2],[3.17,-3.5,3.2]);
  const low=Math.min(...skin.map(([x,py,z])=>rotatedHeight(s,x,py,z)));
  y=Math.max(y,.23-low);
 }
 return y;
}
function rotatedHeight(s:FlightState,x:number,y:number,z:number){return (-x*Math.sin(s.bank)+y*Math.cos(s.bank))*Math.cos(s.pitch)-z*Math.sin(s.pitch);}
export function aircraftPointHeight(s:FlightState,x:number,y:number,z:number){return aircraftBodyHeight(s)+rotatedHeight(s,x,y,z);}
export function runwayAt(x:number,z:number) {return Math.abs(x)<30 && ((z<1500&&z>-1500)||(z<-23500&&z>-26500));}
function recordContact(s:FlightState,kind:ContactKind,severity:number,localX=0,localZ=0){s.contact={id:++s.contactSequence,kind,x:s.x+localX*Math.cos(s.heading)-localZ*Math.sin(s.heading),y:.3,z:s.z+localX*Math.sin(s.heading)+localZ*Math.cos(s.heading),speed:s.speed,severity:clamp(severity,.15,1),paved:runwayAt(s.x,s.z)};}
function crash(s:FlightState,reason:string){s.phase='Crashed';s.crashReason=reason;s.running=false;s.impactAge=0;s.onGround=true;s.vs=0;s.y=Math.max(2.8,s.y);}
export function navigation(s:FlightState) {
 const remaining=Math.hypot(s.x,s.z+23700);
 s.distance=remaining/1852;s.eta=s.speed>10?remaining/s.speed:0;
 s.localizer=clamp(-s.x/120,-2.5,2.5);
 s.glideslope=clamp((Math.max(0,s.z+23700)*Math.tan(3*DEG)+2.8-s.y)/50,-2.5,2.5);
}
export function step(s:FlightState,input:Input,dt:number) {
 if(s.phase==='Crashed'){if(!s.paused){dt=Math.min(dt,.04);s.impactAge+=dt;s.speed=Math.max(0,s.speed-dt*18);s.x+=Math.sin(s.heading)*s.speed*dt;s.z-=Math.cos(s.heading)*s.speed*dt;}navigation(s);return;}
 if(!s.running||s.paused||s.phase==='Complete'){navigation(s);return;}
 dt=Math.min(dt,0.04);s.elapsed+=dt;if(s.cycle)s.time=(s.time+dt/180)%24;
 s.throttle=clamp(s.throttle+input.throttle*dt*.23,0,1);
 s.gearPosition+=(Number(s.gear)-s.gearPosition)*Math.min(1,dt*.8);
 s.n1+=(20+s.throttle*80-s.n1)*dt*.65;
 let pitch=input.pitch, roll=input.roll, yaw=input.yaw;
 const approachDistance=s.z+23700;
 if(s.assist){
  s.ap=true;
  if(s.onGround && !s.touchdown){s.throttle=1;s.flaps=1;yaw=clamp(-s.x*.15-s.heading*4,-1,1);pitch=s.speed>68?clamp((.185-s.pitch)*5,0,.8):0;}
  else if(!s.touchdown){
   s.gear=approachDistance<6000;
   s.flaps=approachDistance<6500?3:approachDistance<10000?2:s.y<180?1:0;
   s.approach=approachDistance<14000;
   s.altHold=true;s.hdgHold=true;
   const points=PLANS[s.plan].points;const wp=points[Math.min(s.waypoint,points.length-1)];
   if(Math.hypot(s.x-wp.x,s.z-wp.z)<600)s.waypoint=Math.min(s.waypoint+1,points.length-1);
   s.targetHeading=(Math.atan2(wp.x-s.x,-(wp.z-s.z))/DEG+360)%360;
   s.targetAlt=2500;
   const targetSpeed=s.approach?(approachDistance<9000?74:100):s.y<350?100:130;
   s.throttle=clamp(.46+(targetSpeed-s.speed)*.04+(s.approach?-.04:.13),0,1);
  }else{s.throttle=0;s.reverse=true;s.brake=true;pitch=-.2;yaw=clamp(-s.x*.15-s.heading*5,-1,1);}
 }
 if(s.ap && !s.onGround){
  if(s.approach){
   s.targetHeading=(clamp(-s.x/Math.max(500,approachDistance)*2,-.35,.35)/DEG+360)%360;
   s.hdgHold=true;s.altHold=true;
  }
  if(s.hdgHold){const err=wrap(s.targetHeading*DEG-s.heading);roll=clamp((clamp(err*1.6,-.35,.35)-s.bank)*2,-1,1);}
  if(s.altHold){
   let alt=s.approach?Math.max(2.8,approachDistance*Math.tan(3*DEG)+2.8):s.targetAlt/FT;
   let targetVS=clamp((alt-s.y)*.3-(s.approach?s.speed*Math.tan(3*DEG):0),-9,12);
   if(s.approach&&s.y<8){targetVS=-1.2;s.throttle=Math.min(s.throttle,s.y<5?.15:.35);}
   // Feed-forward lift equilibrium plus vertical-speed feedback.
   const q=.5*1.225*Math.exp(-s.y/9000)*Math.max(s.speed*s.speed,400)*124.6;
   const requiredCl=62000*9.81/(q*Math.max(.6,Math.cos(s.bank)));
   const trimAoA=(requiredCl-.23-FLAPS[s.flaps]*.025)/4.8;
   const flightPath=Math.atan2(s.vs,Math.max(s.speed,1));
   const desiredPitch=clamp(trimAoA+flightPath+(targetVS-s.vs)*.023,-.3,.25);
   pitch=clamp((desiredPitch-s.pitch)*5,-1,1);
  }
 }
 s.controlPitch=pitch;s.controlRoll=roll;s.controlYaw=yaw;
 s.bank=clamp(s.bank+(roll*.55-s.bank*.25)*dt,-1.15,1.15);
 s.pitch=clamp(s.pitch+(pitch*.20-s.pitch*.045)*dt,-.35,.38);
 if(s.onGround){s.bank*=Math.exp(-dt*4);s.pitch=Math.max(0,s.pitch);if(s.speed<65&&!s.touchdown)s.pitch=Math.min(s.pitch,.015);s.heading+=yaw*.22*clamp(s.speed/25,0,1)*dt;}
 else{s.heading+=(9.81*Math.tan(s.bank)/Math.max(s.speed,30)+yaw*.05)*dt;}
 s.heading=wrap(s.heading);
 const flap=FLAPS[s.flaps];const mass=62000;
 const rho=1.225*Math.exp(-s.y/9000);
 const aoa=s.pitch-Math.atan2(s.vs,Math.max(s.speed,1));
 const stallAngle=(16+flap*.08)*DEG;
 s.stall=!s.onGround&&(Math.abs(aoa)>stallAngle||s.speed<48);
 let cl=.23+4.8*aoa+flap*.025;
 if(Math.abs(aoa)>stallAngle)cl*=Math.max(.22,1-(Math.abs(aoa)-stallAngle)*3);
 cl=clamp(cl,-.8,2.25);
 const groundEffect=1+.13*Math.exp(-Math.max(0,s.y-2.8)/15);
 const lift=.5*rho*s.speed*s.speed*124.6*cl*groundEffect;
 const drag=.5*rho*s.speed*s.speed*124.6*(.024+.045*cl*cl+flap*.004+s.gearPosition*.025);
 const thrust=((s.n1-20)/80)*242000*(s.reverse&&s.onGround?-.48:1);
 const braking=s.onGround&& (s.brake||input.brake)?4.0:0;
 const rolling=s.onGround?.14:0;
 s.speed=Math.max(0,s.speed+(thrust/mass-drag/mass-9.81*Math.sin(s.pitch)-braking-rolling)*dt);
 const weatherScale=s.weather==='Rain'?1:s.weather==='Cloudy'?.6:s.weather==='Fog'?.25:.15;
 const gust=Math.sin(s.elapsed*1.1)*Math.cos(s.elapsed*2.3)*s.turbulence*weatherScale;
 if(!s.onGround){s.vs+=(lift*Math.cos(s.bank)/mass-9.81+gust)*dt;s.bank+=gust*dt*.025;}
 else if(lift*Math.cos(s.bank)>mass*9.81&&s.pitch>.045&&s.speed>62&&!s.touchdown){s.onGround=false;s.noseDown=false;s.vs=.8;s.phase='Climb';}
 s.y+=s.vs*dt;
 const wind=s.wind+gust*1.8;
 s.x+=(Math.sin(s.heading)*s.speed+(s.onGround?wind*.04:wind))*dt;
 s.z-=Math.cos(s.heading)*s.speed*dt;
 if(s.running&&s.phase==='Preflight'&&s.speed>1)s.phase='Takeoff';
 // Contact points follow the same pitch/roll pose as the rendered 737.
 if(!s.touchdown&&s.speed>8){
  const height=(x:number,y:number,z:number)=>aircraftPointHeight(s,x,y,z);
  const lowWing=s.bank>0?16.6:-16.6;
  if(!s.onGround&&s.pitch<-.04&&(height(0,-1.04,-18.55)<.23||(s.gearPosition>.9&&height(0,-3.5,-13)<.21))){recordContact(s,'nosestrike',.4+Math.abs(s.vs)/8,0,-17);crash(s,'The aircraft struck the runway nose first.');navigation(s);return;}
  const kind:ContactKind|null=s.onGround&&s.gearPosition<.55?'belly':height(0,-.5,17)<.23?'tailstrike':height(lowWing,.43,4.48)<.23?'wingstrike':null;
  if(kind){recordContact(s,kind,.4+s.speed/180,kind==='wingstrike'?lowWing:0,kind==='tailstrike'?17:kind==='wingstrike'?4.48:0);crash(s,kind==='tailstrike'?'The tail struck the ground during rotation.':kind==='wingstrike'?'A wing struck the ground.':'The landing gear collapsed or retracted during the ground roll.');navigation(s);return;}
 }
 if(!s.onGround){
  if(s.y>600&&s.phase==='Climb')s.phase='Cruise';
  if(approachDistance<8500&&s.z<-5000)s.phase=s.y<18?'Landing':'Approach';
  if(s.y<=2.8){
   const rate=Math.abs(s.vs)*196.85;
   if(!s.gear||s.gearPosition<.9||!runwayAt(s.x,s.z)||rate>1000||Math.abs(s.bank)>.18||Math.abs(s.heading)>.35){
    recordContact(s,!s.gear||s.gearPosition<.9?'belly':'impact',Math.abs(s.vs)/8+s.speed/250);
    crash(s,!s.gear||s.gearPosition<.9?'Landing gear was retracted.':!runwayAt(s.x,s.z)?'The aircraft touched down outside the runway.':rate>1000?'The descent rate exceeded the landing limit.':'Touchdown attitude was outside safe limits.');
   }else{
    recordContact(s,'touchdown',rate/800,0,3.2);
    s.touchdown={rate,offset:Math.abs(s.x),score:Math.round(clamp(100-rate*.07-Math.abs(s.x)*1.3,0,100)),mainTime:s.elapsed,noseTime:null};s.phase='Rollout';
   }
   s.y=2.8;s.vs=0;s.onGround=true;
  }
 }
 if(s.touchdown){s.pitch=Math.max(0,s.pitch-dt*.025);if(s.pitch<.025){if(s.touchdown.noseTime===null&&s.elapsed>s.touchdown.mainTime)recordContact(s,'nosewheel',.18,0,-13);s.noseDown=true;s.touchdown.noseTime??=s.elapsed;}if(s.speed<1){s.speed=0;s.phase='Complete';s.running=false;}}
 if(s.onGround&&!runwayAt(s.x,s.z)&&s.speed>35&&s.running){recordContact(s,'excursion',s.speed/100);crash(s,'The aircraft overran the runway.');}
 s.warning=s.stall?'STALL · LOWER NOSE':!s.gear&&s.y<160&&!s.onGround&&s.vs<-.5?'GEAR · TOO LOW':s.speed*KT>330?'OVERSPEED':s.speed*KT>132&&s.onGround&&!s.touchdown?'ROTATE':'';
 navigation(s);
}
