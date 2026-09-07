import * as THREE from 'three';
import type {ContactEvent,FlightState} from './physics';
type Particle={x:number;y:number;z:number;vx:number;vy:number;vz:number;life:number;maxLife:number;size:number;spark:boolean;dust:boolean};
const vertex=`attribute float opacity;attribute float particleSize;varying float vOpacity;uniform float pixelScale;void main(){vOpacity=opacity;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(particleSize*pixelScale/max(1.,-p.z),1.,140.);}`;
const fragment=`varying float vOpacity;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(.56,.53,.47,vOpacity*pow(1.-r*r,2.));}`;
export class GroundEffects {
 private particles:Particle[]=[];private lastContact=0;private trail=0;private shake=0;private cursor=0;
 private sparks:THREE.LineSegments;private smoke:THREE.Points;private marks:THREE.InstancedMesh;
 private sparkPositions=new Float32Array(768*6);private sparkColors=new Float32Array(768*6);
 private smokePositions=new Float32Array(768*3);private smokeOpacity=new Float32Array(768);private smokeSize=new Float32Array(768);
 constructor(scene:THREE.Scene){
  const sparks=new THREE.BufferGeometry();sparks.setAttribute('position',new THREE.BufferAttribute(this.sparkPositions,3).setUsage(THREE.DynamicDrawUsage));sparks.setAttribute('color',new THREE.BufferAttribute(this.sparkColors,3).setUsage(THREE.DynamicDrawUsage));sparks.setDrawRange(0,0);
  this.sparks=new THREE.LineSegments(sparks,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));this.sparks.frustumCulled=false;scene.add(this.sparks);
  const smoke=new THREE.BufferGeometry();smoke.setAttribute('position',new THREE.BufferAttribute(this.smokePositions,3).setUsage(THREE.DynamicDrawUsage));smoke.setAttribute('opacity',new THREE.BufferAttribute(this.smokeOpacity,1).setUsage(THREE.DynamicDrawUsage));smoke.setAttribute('particleSize',new THREE.BufferAttribute(this.smokeSize,1).setUsage(THREE.DynamicDrawUsage));smoke.setDrawRange(0,0);
  this.smoke=new THREE.Points(smoke,new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{pixelScale:{value:700}},transparent:true,depthWrite:false}));this.smoke.frustumCulled=false;scene.add(this.smoke);
  this.marks=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x111416,transparent:true,opacity:.48,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),96);this.marks.count=0;this.marks.frustumCulled=false;scene.add(this.marks);
 }
 private burst(event:ContactEvent,heading:number,count:number,metal:boolean){
  for(let i=0;i<count&&this.particles.length<768;i++){
   const spark=metal&&i%4!==0,spread=spark?12:4,life=spark?.3+Math.random()*.7:1.4+Math.random()*2.3;
   // Most sparks spray aft relative to the moving aircraft.
   this.particles.push({x:event.x+(Math.random()-.5)*1.5,y:event.y+.1,z:event.z+(Math.random()-.5)*1.5,vx:(Math.random()-.5)*spread-Math.sin(heading)*event.speed*.18,vy:spark?2+Math.random()*7:1+Math.random()*2,vz:(Math.random()-.5)*spread+Math.cos(heading)*event.speed*.18,life,maxLife:life,size:spark?.1:1+Math.random()*2,spark,dust:!event.paved});
  }
 }
 private mark(x:number,z:number,heading:number,length:number){const obj=new THREE.Object3D();obj.position.set(x,.305,z);obj.rotation.set(-Math.PI/2,0,heading);obj.scale.set(.45,length,1);obj.updateMatrix();this.marks.setMatrixAt(this.cursor%96,obj.matrix);this.cursor++;this.marks.count=Math.min(this.cursor,96);this.marks.instanceMatrix.needsUpdate=true;}
 reset(){this.particles=[];this.lastContact=0;this.trail=0;this.shake=0;this.cursor=0;this.marks.count=0;this.sparks.geometry.setDrawRange(0,0);this.smoke.geometry.setDrawRange(0,0);}
 update(s:FlightState,dt:number,pixelScale:number){
  if(s.phase==='Preflight'){this.reset();return 0;}
  if(s.paused)return 0;
  dt=Math.min(dt,.1);const event=s.contact;
  if(event&&event.id!==this.lastContact){
   this.lastContact=event.id;const touchdown=event.kind==='touchdown'||event.kind==='nosewheel';this.shake=Math.max(this.shake,touchdown?event.severity*.18:event.severity*.9);
   if(event.kind==='touchdown')for(const side of [-1,1]){const x=event.x+side*2.85*Math.cos(s.heading),z=event.z+side*2.85*Math.sin(s.heading);this.burst({...event,x,z},s.heading,25+Math.round(event.severity*35),false);if(event.paved)this.mark(x,z,s.heading,6+event.speed*.07);}
   else{this.burst(event,s.heading,touchdown?12:150,!touchdown&&event.paved);if(event.paved)this.mark(event.x,event.z,s.heading,touchdown?3:18);}
  }
  if(s.phase==='Crashed'&&s.speed>3&&s.impactAge<4&&event){this.trail+=dt;while(this.trail>.04){this.trail-=.04;const tail=event.kind==='tailstrike'?17:0,wing=event.kind==='wingstrike'?(s.bank>0?16.6:-16.6):0;this.burst({...event,x:s.x+wing*Math.cos(s.heading)-tail*Math.sin(s.heading),z:s.z+wing*Math.sin(s.heading)+tail*Math.cos(s.heading)},s.heading,12,event.paved);}}
  let sparkCount=0,smokeCount=0;
  for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue;}p.vy+=(p.spark?-16:.5)*dt;p.vx*=Math.exp(-dt*(p.spark?.5:1.2));p.vz*=Math.exp(-dt*(p.spark?.5:1.2));p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<.32){p.y=.32;p.vy=Math.abs(p.vy)*.32;}const fade=p.life/p.maxLife;
   if(p.spark){const n=sparkCount++*6;this.sparkPositions.set([p.x,p.y,p.z,p.x-p.vx*.04,p.y-p.vy*.04,p.z-p.vz*.04],n);this.sparkColors.set([fade*2,fade*.85,fade*.12,fade*.6,fade*.15,0],n);}
   else{const n=smokeCount++;this.smokePositions.set([p.x,p.y,p.z],n*3);this.smokeOpacity[n]=fade*.5;this.smokeSize[n]=p.size+(p.maxLife-p.life)*(p.dust?3:2);}
  }
  this.sparks.geometry.setDrawRange(0,sparkCount*2);this.sparks.geometry.attributes.position.needsUpdate=true;this.sparks.geometry.attributes.color.needsUpdate=true;
  this.smoke.geometry.setDrawRange(0,smokeCount);for(const name of ['position','opacity','particleSize'])this.smoke.geometry.attributes[name].needsUpdate=true;(this.smoke.material as THREE.ShaderMaterial).uniforms.pixelScale.value=pixelScale;
  this.shake*=Math.exp(-dt*5);return this.shake;
 }
}
