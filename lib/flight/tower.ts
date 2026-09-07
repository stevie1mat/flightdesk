import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function outline(width:number,depth:number,radius:number){const x=width/2,z=depth/2,r=radius,s=new THREE.Shape();s.moveTo(-x+r,-z);s.lineTo(x-r,-z);s.quadraticCurveTo(x,-z,x,-z+r);s.lineTo(x,z-r);s.quadraticCurveTo(x,z,x-r,z);s.lineTo(-x+r,z);s.quadraticCurveTo(-x,z,-x,z-r);s.lineTo(-x,-z+r);s.quadraticCurveTo(-x,-z,-x+r,-z);return s;}
function pane(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,center:THREE.Vector3){const points=[a,b,c,d],normal=b.clone().sub(a).cross(c.clone().sub(a)),out=a.clone().add(b).add(c).add(d).multiplyScalar(.25).sub(center);out.y=0;const index=normal.dot(out)>0?[0,1,2,0,2,3]:[0,2,1,0,3,2],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>p.toArray()),3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));g.setIndex(index);g.computeVertexNormals();return g;}

export class ControlTower {
 readonly group=new THREE.LOD();
 private glass:THREE.MeshPhysicalMaterial[]=[];
 private glow=new THREE.MeshStandardMaterial({color:0xffeed1,emissive:0xffd28b,emissiveIntensity:0,roughness:.4});
 private beacon:THREE.Mesh;
 constructor(){
  this.group.name='Sculpted airport control tower';
  const concrete=new THREE.MeshStandardMaterial({color:0xdad5c7,roughness:.78,metalness:.01});concrete.name='warm architectural concrete';
  const metal=new THREE.MeshStandardMaterial({color:0x536571,roughness:.35,metalness:.72});metal.name='curtain wall mullions';
  const trim=new THREE.MeshStandardMaterial({color:0xb4bec0,roughness:.3,metalness:.62});trim.name='silver roof edges';
  const pavement=new THREE.MeshStandardMaterial({color:0x9ca49f,roughness:.92});
  const dark=new THREE.MeshStandardMaterial({color:0x182c39,roughness:.62});
  for(const [i,color] of [0x3a6074,0x456f81,0x527e8e,0x345867].entries()){const mat=new THREE.MeshPhysicalMaterial({color,roughness:.2,metalness:.30,clearcoat:.55,clearcoatRoughness:.18,envMapIntensity:.85,emissive:i===3?0xd4b48a:0x638ca7,emissiveIntensity:0,side:THREE.DoubleSide});mat.name=`blue reflective glazing ${i+1}`;this.glass.push(mat);}
  const detail=new THREE.Group();detail.name='detailed tower';const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();
  const add=(geometry:THREE.BufferGeometry,material:THREE.Material,matrix?:THREE.Matrix4)=>{if(matrix)geometry.applyMatrix4(matrix);const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();const list=buckets.get(material)||[];list.push(g);buckets.set(material,list);};
  const block=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material)=>add(new THREE.BoxGeometry(w,h,d),mat,new THREE.Matrix4().makeTranslation(x,y,z));
  const beam=(a:THREE.Vector3,b:THREE.Vector3,r:number,mat:THREE.Material)=>{const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());add(new THREE.CylinderGeometry(r,r,a.distanceTo(b),8),mat,new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),rotation,new THREE.Vector3(1,1,1)));};
  const slab=(w:number,d:number,r:number,y:number,height:number,mat:THREE.Material,x=0,z=0)=>{const g=new THREE.ExtrudeGeometry(outline(w,d,r),{depth:height,bevelEnabled:true,bevelSize:.10,bevelThickness:.07,bevelSegments:2,curveSegments:10});g.rotateX(-Math.PI/2);g.translate(x,y,z);add(g,mat);};
  const curtain=(y:number,height:number,w:number,d:number,taper:number,cx=0,cz=0)=>{
   const points=outline(w,d,Math.min(w,d)*.28).getSpacedPoints(48).slice(0,-1),rows=Math.round(height/2.7),center=new THREE.Vector3(cx,y+height/2,cz);
   const at=(p:THREE.Vector2,f:number)=>new THREE.Vector3(cx+p.x*(1+(taper-1)*f),y+height*f,cz+p.y*(1+(taper-1)*f));
   points.forEach((p,i)=>{const next=points[(i+1)%points.length];beam(at(p,0),at(p,1),.075,metal);for(let row=0;row<rows;row++){const a=row/rows,b=(row+1)/rows;add(pane(at(p,a),at(next,a),at(next,b),at(p,b),center),this.glass[(i*7+row*3)%4]);}for(let row=0;row<=rows;row++)beam(at(p,row/rows),at(next,row/rows),row===0||row===rows?.12:.075,metal);});
  };
  // Glazed, tapered podium with an entrance plaza and terrace.
  slab(47,39,5,.1,.45,pavement);slab(36,28,4,.55,.6,concrete);curtain(1.2,11.7,34,26,.79);slab(28.4,21.9,4,12.9,.7,trim);
  block(11,.18,19,0,.18,23,pavement);for(let i=0;i<3;i++)block(10-i,.18,2.2,0,.26+i*.18,14.1-i*.8,concrete);
  for(const x of [-1.1,1.1]){block(2.1,3.25,.12,x,2.5,13.05,this.glass[3]);beam(new THREE.Vector3(x,1.8,13.16),new THREE.Vector3(x,2.8,13.16),.04,trim);}
  block(8.2,.28,3.7,0,4.3,13.7,trim);block(7.4,.06,.18,0,4.1,15.4,this.glow);
  const terrace=outline(28.2,21.7,4).getSpacedPoints(48).slice(0,-1);terrace.forEach((p,i)=>{const q=terrace[(i+1)%terrace.length];beam(new THREE.Vector3(p.x,13.6,p.y),new THREE.Vector3(p.x,14.65,p.y),.035,trim);beam(new THREE.Vector3(p.x,14.65,p.y),new THREE.Vector3(q.x,14.65,q.y),.04,trim);});
  // Three splayed piers frame the slim central service shaft.
  add(new THREE.CylinderGeometry(3.5,4.6,56,48),concrete,new THREE.Matrix4().makeTranslation(0,28,0));
  for(const angle of [Math.PI/6,Math.PI*5/6,Math.PI*3/2]){const foot=new THREE.Vector3(Math.cos(angle)*16.2,1.0,Math.sin(angle)*16.2),head=new THREE.Vector3(Math.cos(angle)*2.5,58,Math.sin(angle)*2.5),length=foot.distanceTo(head);const shape=new THREE.Shape();shape.moveTo(-2.2,0);shape.lineTo(2.2,0);shape.lineTo(1.7,length);shape.lineTo(-1.7,length);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:3.2,bevelEnabled:true,bevelSize:.16,bevelThickness:.12,bevelSegments:3});g.translate(0,0,-1.6);const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),head.clone().sub(foot).normalize());add(g,concrete,new THREE.Matrix4().compose(foot,q,new THREE.Vector3(1,1,1)));}
  // Rounded office collar and cantilevered panoramic control cab.
  slab(20.6,13.8,4.2,54,.95,concrete);curtain(55,11.4,20,13.3,1.02);slab(21.1,14.3,4.5,66.4,.7,trim);
  block(13.5,2.2,8.5,-.6,67.5,0,concrete);
  slab(27.5,17.8,5.2,68,.9,concrete,-1.3,0);curtain(68.9,19.8,26.5,17,1.035,-1.3,0);slab(28.1,18.3,5.4,88.7,.8,trim,-1.3,0);slab(26.6,16.8,5,89.5,.3,dark,-1.3,0);
  // Roof equipment, antenna mast and exposed cab lighting strips.
  block(6,.8,4,-1.3,90.1,0,trim);beam(new THREE.Vector3(-1.3,90.5,0),new THREE.Vector3(-1.3,96,0),.08,metal);beam(new THREE.Vector3(-3.2,94.3,0),new THREE.Vector3(.6,94.3,0),.035,trim);
  for(const x of [-9,6])block(.18,.12,10,x,88.6,0,this.glow);
  for(const z of [-5.5,5.5])block(17,.12,.16,-1.3,68.7,z,this.glow);
  for(const [mat,geometries] of buckets){const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(merged,mat);mesh.name=mat.name||'tower structure';mesh.castShadow=true;mesh.receiveShadow=true;detail.add(mesh);}
  this.group.addLevel(detail,0);
  // A few silhouettes retain the same architecture when the other airport is distant.
  const distant=new THREE.Group();distant.name='distant tower';const simple=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);distant.add(mesh);return mesh;};
  simple(new THREE.CylinderGeometry(3.5,4.6,56,12),concrete,0,28,0);simple(new THREE.CylinderGeometry(14,18,13,12),this.glass[1],0,6.5,0);simple(new THREE.BoxGeometry(20,12,13),this.glass[1],0,61,0);simple(new THREE.BoxGeometry(27.5,21,18),this.glass[2],-1.3,79,0);simple(new THREE.BoxGeometry(28.1,.8,18.3),trim,-1.3,89.1,0);
  for(const angle of [Math.PI/6,Math.PI*5/6,Math.PI*3/2]){const a=new THREE.Vector3(Math.cos(angle)*16.2,1,Math.sin(angle)*16.2),b=new THREE.Vector3(Math.cos(angle)*2.5,58,Math.sin(angle)*2.5),mesh=simple(new THREE.CylinderGeometry(1.7,2.2,a.distanceTo(b),5),concrete,0,0,0);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());}
  this.group.addLevel(distant,1800,.12);
  this.beacon=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8),new THREE.MeshBasicMaterial({color:0xff342d,toneMapped:false}));this.beacon.name='tower obstruction beacon';this.beacon.position.set(-1.3,96,0);this.group.add(this.beacon);
 }
 update(night:number,time:number){this.glass.forEach((mat,i)=>mat.emissiveIntensity=night*(i===3?.85:.18));this.glow.emissiveIntensity=night*2.2;this.beacon.visible=night>.1&&Math.sin(time*3.2)>.05;}
}
