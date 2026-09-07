import * as THREE from 'three';
import type {FlightState} from './physics';
const mat=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.65});
function block(g:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
function sign(g:THREE.Object3D,text:string,x:number,y:number,z:number,w=8){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#102f3b';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#e7c393';ctx.font='600 66px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,128,950);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const o=new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),new THREE.MeshBasicMaterial({map:t}));o.position.set(x,y,z);g.add(o);}
export class PilotWorld{
 group=new THREE.Group();private people:{group:THREE.Group;legs:THREE.Mesh[];offset:number;airport:number}[]=[];
 private stairs=new THREE.Group();
 private lamps=new THREE.MeshStandardMaterial({color:0xffe0a3,emissive:0xffd094,emissiveIntensity:.4});
 constructor(scene:THREE.Scene){scene.add(this.group);const wall=mat(0xd5d0bd),dark=mat(0x203943),wood=mat(0x9d7452),seat=mat(0x387875),paving=mat(0xb8beb4),uniform=mat(0x182a3f),skin=mat(0xb98561);
 this.group.add(this.stairs);for(let i=0;i<10;i++){const h=.27*(i+1),x=-5.8+i*.34;block(this.stairs,.36,h,1.3,x,h/2,-14.2,wall);for(const z of [-14.9,-13.5]){block(this.stairs,.04,.85,.04,x,h+.425,z,dark);block(this.stairs,.38,.05,.05,x,h+.85,z,dark);}}sign(this.stairs,'BOARD · E',-5.5,1.8,-12.9,1.6);
 for(const airport of [0,-25000]){const g=new THREE.Group();g.position.set(90,0,airport+1100);this.group.add(g);
 block(g,34,.12,27,0,.08,0,paving);block(g,24,4.8,.4,0,2.4,-8,wall);block(g,.4,4.8,16,-12,2.4,0,wall);block(g,.4,4.8,16,12,2.4,0,wall);for(const x of [-8,8]){block(g,8,1, .4,x,.5,8,wall);block(g,8,3.4,.12,x,2.7,8,new THREE.MeshPhysicalMaterial({color:0x548a9a,transparent:true,opacity:.38,roughness:.14,metalness:.15}));}block(g,25,.35,18,0,4.9,0,dark);sign(g,'PILOT LOUNGE',0,4,8.3,9);sign(g,'REST  •  EXPLORE  •  FLY',0,3,-7.7,10);
 for(const x of [-7,7])for(const z of [-3,3]){block(g,3,.5,1.2,x,.7,z,seat);block(g,3,1,.25,x,1.1,z-.5,seat);block(g,2.5,.1,1.5,x,1,z+1.6,wood);}block(g,7,1,1.3,0,.6,-5.7,wood);sign(g,'CREW ROOM',0,2.5,-7.6,5);for(const x of [-8,0,8])block(g,3,.04,.6,x,4.65,0,this.lamps);
 // A lit pedestrian path leads to the lounge from the runway side.
 block(g,42,.07,3,-34,.04,10,paving);for(const x of [-49,-32,-15,15]){block(g,.1,3.2,.1,x,1.6,12,dark);block(g,.65,.1,.65,x,3.2,12,this.lamps);}
 for(let i=0;i<4;i++){const person=new THREE.Group();const legs:THREE.Mesh[]=[];block(person,.48,.65,.27,0,1.13,0,uniform);const head=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),skin);head.position.y=1.65;person.add(head);block(person,.4,.07,.34,0,1.8,0,uniform);for(const side of [-1,1]){legs.push(block(person,.16,.7,.18,side*.13,.43,0,uniform));block(person,.13,.6,.15,side*.32,1.13,0,wall);}this.group.add(person);this.people.push({group:person,legs,offset:i*1.7,airport});}
 }
 }
 update(time:number,night:number,s:FlightState,walking:boolean){this.stairs.visible=walking;this.stairs.position.set(s.x,.21,s.z);this.stairs.rotation.y=-s.heading;this.lamps.emissiveIntensity=.4+night*2;for(const p of this.people){const a=time*.065+p.offset;p.group.position.set(90+Math.cos(a)*23,.18,p.airport+1120+Math.sin(a)*7);p.group.rotation.y=-a;for(let i=0;i<2;i++)p.legs[i].rotation.x=Math.sin(time*5+p.offset+i*Math.PI)*.35;}}
}
