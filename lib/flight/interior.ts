import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {FlightState} from './physics';
export const CABIN_FLOOR=-1.1;
export class AircraftInterior{
 group=new THREE.Group();colliders:THREE.Mesh[]=[];private screens:THREE.CanvasTexture[]=[];private last=-1;
 constructor(parent:THREE.Object3D){parent.add(this.group);this.group.name='Walkable 737 cabin and cockpit';this.group.visible=false;
 const wall=new THREE.MeshStandardMaterial({color:0xe1ded0,roughness:.8,side:THREE.DoubleSide}),carpet=new THREE.MeshStandardMaterial({color:0x273d48,roughness:1}),seat=new THREE.MeshStandardMaterial({color:0x284b66,roughness:.8}),trim=new THREE.MeshStandardMaterial({color:0x66737a,roughness:.6}),panel=new THREE.MeshStandardMaterial({color:0x283139,roughness:.85}),light=new THREE.MeshBasicMaterial({color:0xffedc9}),windowGlass=new THREE.MeshBasicMaterial({color:0x779db3});
 const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,collision=true)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.name=name;mesh.position.set(x,y,z);mesh.receiveShadow=true;this.group.add(mesh);if(collision)this.colliders.push(mesh);return mesh;};
 box('Cabin carpet',3.5,.08,29.8,0,CABIN_FLOOR-.04,-.5,carpet);box('Cockpit floor',2.7,.08,3.3,0,CABIN_FLOOR-.04,-16.25,carpet);box('Cockpit ceiling',2.7,.08,2.9,0,1.35,-16.25,wall);for(const side of [-1,1])box('Cockpit sidewall',.08,2.45,2.9,side*1.35,.12,-16.25,wall);box('Center windscreen pillar',.06,1.1,.08,0,.73,-17.57,trim);
 box('Cabin ceiling',3.1,.10,29,0,1.72,-.3,wall);for(const side of [-1,1]){
 box('Cabin sidewall',.08,2.6,27,side*1.73,.20,-.4,wall);
 box('Overhead luggage bins',.49,.47,26.5,side*1.36,1.37,-.1,wall);
 box('Cabin light strip',.06,.02,27,side*.90,1.65,-.3,light,false);
 for(let row=0;row<27;row++){const z=-12.6+row*.94;
 for(let col=0;col<2;col++){const x=side*(.74+col*.48);box('Passenger seat cushion',.43,.13,.48,x,-.59,z,seat);box('Passenger seat back',.43,.87,.12,x,-.10,z+.24,seat);box('Headrest',.32,.23,.15,x,.30,z+.21,seat);}
 box('Armrest',.07,.08,.44,side*.49,-.31,z,trim);
 // Lit window recesses remain visible on the interior side of the exterior shell.
 box('Cabin window surround',.05,.48,.34,side*1.675,.45,z,trim,false);box('Cabin window glass',.055,.37,.25,side*1.642,.45,z,windowGlass,false);
 }}
 box('Rear pressure bulkhead',3.4,2.7,.12,0,.22,13.1,wall);
 // Forward vestibule leaves an open passage to the flight deck and left entrance.
 for(const side of [-1,1])box('Cockpit doorway',.64,2.55,.12,side*1.12,.16,-14.9,wall);
 box('Forward galley',.55,1.7,1.3,1.38,-.25,-14.05,wall);box('Exit door',.12,2.3,.8,-1.73,.02,-14.15,trim);
 for(const side of [-1,1]){
 box('Captain chair',.57,.16,.6,side*.73,-.52,-16.15,seat);box('Captain seat back',.57,.89,.15,side*.73,-.05,-15.90,seat);
 box('Cockpit side console',.29,.52,1.6,side*1.17,-.69,-16.2,panel);
 // Transparent front remains open to the exterior view through the windscreen.
 box('Windscreen pillar',.055,1.15,.10,side*.95,.70,-17.40,trim);
 const yoke=box('Control column',.06,.53,.07,side*.73,-.33,-16.90,trim);box('Control yoke',.38,.055,.07,side*.73,-.08,-16.9,panel);
 }
 box('Instrument panel',2.2,.56,.27,0,-.10,-17.23,panel);box('Glare shield',2.25,.10,.45,0,.24,-17.22,panel);box('Center pedestal',.35,.47,1.1,0,-.82,-16.48,panel);
 for(const x of [-.09,.09]){box('Throttle lever',.035,.32,.035,x,-.44,-16.58,trim);box('Throttle handle',.08,.06,.10,x,-.27,-16.58,panel);}
 for(const x of [-.83,-.29,.29,.83]){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;this.screens.push(texture);const screen=new THREE.Mesh(new THREE.PlaneGeometry(.43,.40),new THREE.MeshBasicMaterial({map:texture}));screen.name='Live cockpit display';screen.position.set(x,-.08,-17.08);this.group.add(screen);}
 const batches=new Map<THREE.Material,THREE.Mesh[]>();for(const o of [...this.group.children])if(o instanceof THREE.Mesh&&o.name!=='Live cockpit display'){const material=o.material as THREE.Material;const batch=batches.get(material)??[];batch.push(o);batches.set(material,batch);}
 this.colliders=[];for(const [material,meshes] of batches){const geometries=meshes.map(o=>{o.updateMatrix();return o.geometry.clone().applyMatrix4(o.matrix);});const merged=mergeGeometries(geometries);const surface=new THREE.Mesh(merged,material);surface.name='Batched cabin surfaces';surface.receiveShadow=true;this.group.add(surface);this.colliders.push(surface);for(const o of meshes){this.group.remove(o);o.geometry.dispose();}geometries.forEach(g=>g.dispose());}
 for(const z of [-10,0,10]){const lamp=new THREE.PointLight(0xffedcf,8,13,2);lamp.position.set(0,1.3,z);this.group.add(lamp);}const cockpitLamp=new THREE.PointLight(0xcce2ef,3,4,2);cockpitLamp.position.set(0,1.1,-16);this.group.add(cockpitLamp);

 }
 update(s:FlightState,visible:boolean){this.group.visible=visible;if(!visible||Math.floor(s.elapsed*5)===this.last)return;this.last=Math.floor(s.elapsed*5);this.screens.forEach((t,i)=>{const c=t.image as HTMLCanvasElement,ctx=c.getContext('2d')!;ctx.fillStyle='#061319';ctx.fillRect(0,0,256,256);if(i%2===0){ctx.fillStyle='#276a91';ctx.fillRect(45,45,166,83);ctx.fillStyle='#846f42';ctx.fillRect(45,128,166,83);ctx.strokeStyle='#ffd578';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(90,128);ctx.lineTo(166,128);ctx.stroke();}else{ctx.strokeStyle='#80dbb1';ctx.lineWidth=2;ctx.beginPath();ctx.arc(128,132,82,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#f4b96f';ctx.fillRect(125,57,6,120);}ctx.fillStyle='#d3eee8';ctx.font='18px monospace';ctx.fillText(i%2===0?'PFD  737':'NAV  737',12,25);ctx.fillText(`${Math.round(s.speed*1.94384)} KT`,10,242);ctx.fillText(`${Math.round((s.y-2.8)*3.28084)} FT`,139,242);t.needsUpdate=true;});}
 dispose(){this.screens.forEach(t=>t.dispose());}
}
