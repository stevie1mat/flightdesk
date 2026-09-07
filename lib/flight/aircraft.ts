import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {boeingPaint,aircraftLettering} from './livery';
import { FLAPS, type FlightState } from './physics';

// 737-800 envelope: 39.47 m length / 35.79 m span. Local nose is -Z.
// Surface details and systems are modeled for this game, not an engineering CAD replica.
const D=Math.PI/180;
const stations=[[-19.735,.045,.035,-.20],[-19.57,.42,.32,-.20],[-19.2,.79,.72,-.08],[-18.55,1.15,1.04,0],[-17.65,1.50,1.44,.03],[-16.45,1.77,1.80,.025],[-14.9,1.88,1.93,0],[-12,1.88,1.95,0],[9.9,1.88,1.95,0],[12.6,1.72,1.78,.12],[15,1.27,1.34,.30],[17.5,.65,.69,.52],[19.3,.13,.17,.63],[19.735,.018,.025,.66]];
function profile(z:number){let i=0;while(i<stations.length-2&&stations[i+1][0]<z)i++;const a=stations[i],b=stations[i+1],before=stations[Math.max(0,i-1)],after=stations[Math.min(stations.length-1,i+2)];const t=THREE.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1),dz=b[0]-a[0];return [1,2,3].map(k=>{const da=(b[k]-before[k])/(b[0]-before[0]),db=(after[k]-a[k])/(after[0]-a[0]);const v=(2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*da*dz+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*db*dz;return k<3?Math.max(.015,v):v;});}
function geometry(points:number[],indices:number[],uv?:number[]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;}
function loft(rings:number[][][],closed=true){const vertices:number[]=[],indices:number[]=[],uv:number[]=[];const n=rings[0].length;for(let j=0;j<rings.length;j++)for(let i=0;i<n;i++){vertices.push(...rings[j][i]);uv.push(i/(n-1),j/(rings.length-1));if(j<rings.length-1&&i<n-1){const a=j*n+i,b=a+n;indices.push(a,b,a+1,b,b+1,a+1);}}if(closed){for(const j of [0,rings.length-1]){const center=rings[j].reduce((a,p)=>a.map((v,k)=>v+p[k]/n),[0,0,0]);const c=vertices.length/3;vertices.push(...center);uv.push(.5,.5);for(let i=0;i<n-1;i++)j===0?indices.push(c,i+1,i):indices.push(c,j*n+i,j*n+i+1);}}return geometry(vertices,indices,uv);}
function mesh(parent:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,name=''){const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function line(parent:THREE.Object3D,points:THREE.Vector3[],material:THREE.LineBasicMaterial,loop=false){const g=new THREE.BufferGeometry().setFromPoints(points);const o=loop?new THREE.LineLoop(g,material):new THREE.Line(g,material);parent.add(o);return o;}
function tube(parent:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material){const o=mesh(parent,new THREE.CylinderGeometry(r,r,a.distanceTo(b),12),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return o;}
function batchChildren(parent:THREE.Object3D,material:THREE.Material){const parts=parent.children.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh&&o.material===material);if(parts.length<2)return;const geometries=parts.map(o=>{o.updateMatrix();return o.geometry.clone().applyMatrix4(o.matrix);});const combined=mergeGeometries(geometries);parts.forEach(o=>{parent.remove(o);o.geometry.dispose();});mesh(parent,combined,material,'batched detail');geometries.forEach(g=>g.dispose());}
function roundRect(w:number,h:number,r:number){const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s;}
function surfacePoint(z:number,y:number,side:number,offset=.012){const [rx,ry,cy]=profile(z);return new THREE.Vector3(side*(rx*Math.sqrt(Math.max(.001,1-((y-cy)/ry)**2))+offset),y,z);}
// Subdivide in surface coordinates before projection. A single flat polygon
// connects its corners through the convex fuselage, burying the window center.
function conformalShape(shape:THREE.Shape,project:(u:number,v:number)=>THREE.Vector3,spacing=.18){
 const flat=new THREE.ShapeGeometry(shape,8),position=flat.attributes.position,index=flat.index!,vertices:number[]=[],normals:number[]=[],uv:number[]=[];
 const emit=(a:THREE.Vector2,b:THREE.Vector2,c:THREE.Vector2,depth=0)=>{
  if(depth<7&&Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))>spacing){const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);emit(a,ab,ca,depth+1);emit(ab,b,bc,depth+1);emit(ca,bc,c,depth+1);emit(ab,bc,ca,depth+1);return;}
  const pa=project(a.x,a.y),face=project(b.x,b.y).sub(pa).cross(project(c.x,c.y).sub(pa));const order=face.x*pa.x+face.y*pa.y<0?[a,c,b]:[a,b,c];
  for(const p of order){const v=project(p.x,p.y),du=project(p.x+.0001,p.y).sub(v),dv=project(p.x,p.y+.0001).sub(v),normal=du.cross(dv).normalize();if(normal.x*v.x+normal.y*v.y<0)normal.negate();vertices.push(v.x,v.y,v.z);normals.push(normal.x,normal.y,normal.z);uv.push(p.x,p.y);}
 };
 for(let i=0;i<index.count;i+=3){const point=(n:number)=>new THREE.Vector2(position.getX(index.getX(n)),position.getY(index.getX(n)));emit(point(i),point(i+1),point(i+2));}
 flat.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}
function surfaceShape(shape:THREE.Shape,z:number,y:number,side:number,offset:number){return conformalShape(shape,(u,v)=>surfacePoint(z+u,y+v,side,offset));}
function cockpitPoint(z:number,angle:number,side:number,offset:number){const [rx,ry,cy]=profile(z);return new THREE.Vector3(side*(rx+offset)*Math.sin(angle),cy+(ry+offset)*Math.cos(angle),z);}
function cockpitShape(points:number[][],scale:number,side:number,offset:number){const center=points.reduce((c,p)=>[c[0]+p[0]/points.length,c[1]+p[1]/points.length],[0,0]),shape=new THREE.Shape();points.forEach(([z,a],i)=>{const u=center[0]+(z-center[0])*scale,v=center[1]+(a-center[1])*scale;i?shape.lineTo(u,v):shape.moveTo(u,v);});shape.closePath();return conformalShape(shape,(z,a)=>cockpitPoint(z,a,side,offset),.09);}
function labelSurface(w:number,h:number,side:number,project:(u:number,v:number)=>THREE.Vector3){const g=new THREE.PlaneGeometry(w,h,Math.ceil(w/.14),Math.ceil(h/.10)),pos=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<pos.count;i++){const p=project(pos.getX(i),pos.getY(i));pos.setXYZ(i,p.x,p.y,p.z);if(side>0)uv.setX(i,1-uv.getX(i));}const index=g.index!;for(let i=0;i<index.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,index.getX(i)),b=new THREE.Vector3().fromBufferAttribute(pos,index.getX(i+1)),c=new THREE.Vector3().fromBufferAttribute(pos,index.getX(i+2)),n=b.sub(a).cross(c.sub(a));if(n.x*a.x+n.y*a.y<0){const j=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,j);}}g.computeVertexNormals();return g;}
function wingGeometry(rows:number[][],side:number,start=0,end=1){const rings=rows.map(([x,y,leading,chord,thickness])=>{const points:number[][]=[];for(let i=0;i<=64;i++){const angle=i/64*Math.PI*2,u=start+(end-start)*(1-Math.cos(angle))*.5;const t=5*thickness*(.2969*Math.sqrt(u)-.126*u-.3516*u*u+.2843*u**3-.1036*u**4);points.push([side*x,y+chord*(Math.sin(angle)>=0?t:-t)+chord*.015*Math.sin(u*Math.PI),leading+u*chord]);}if(start>0)points.push([...points[0]]);return points;});const g=loft(rings);if(side<0){const idx=g.index!;for(let i=0;i<idx.count;i+=3){const b=idx.getX(i+1);idx.setX(i+1,idx.getX(i+2));idx.setX(i+2,b);}g.computeVertexNormals();}return g;}

export class Boeing737 {
 group=new THREE.Group();gear=new THREE.Group();noseGear=new THREE.Group();
 private cockpitHidden:THREE.Object3D[]=[];private wings:THREE.Group[]=[];private flaps:THREE.Group[]=[];private ailerons:THREE.Group[]=[];private elevators:THREE.Group[]=[];private spoilers:THREE.Group[]=[];private mains:THREE.Group[]=[];private wheels:THREE.Group[]=[];private fans:THREE.Group[]=[];private reversers:THREE.Group[]=[];private rudder=new THREE.Group();private doors:THREE.Group[]=[];private beacons:THREE.Mesh[]=[];private flapAngle=0;private gearAngle=0;private wheelTravel=0;private fanAngle=0;private wingFlex=0;
 constructor(){this.group.name='Boeing 737-800';
 const paint=new THREE.MeshPhysicalMaterial({color:0xf2f3ee,roughness:.29,metalness:.08,clearcoat:.65,clearcoatRoughness:.2,side:THREE.DoubleSide});const wingPaint=new THREE.MeshStandardMaterial({color:0xd2d8d8,roughness:.45,metalness:.25,side:THREE.DoubleSide});const glass=new THREE.MeshPhysicalMaterial({color:0x172c3b,metalness:.42,roughness:.12,clearcoat:1,side:THREE.DoubleSide});const frame=new THREE.MeshStandardMaterial({color:0xa9b1b3,metalness:.75,roughness:.28,side:THREE.DoubleSide});const rubber=new THREE.MeshStandardMaterial({color:0x161a1d,roughness:.9});const metal=new THREE.MeshStandardMaterial({color:0xb8bfc1,metalness:.9,roughness:.25});const darkMetal=new THREE.MeshStandardMaterial({color:0x343b40,metalness:.7,roughness:.42,side:THREE.DoubleSide});const seam=new THREE.LineBasicMaterial({color:0x858e91,transparent:true,opacity:.45});
 const bodyPaint=boeingPaint(),tailPaint=boeingPaint(true),bluePaint=new THREE.MeshPhysicalMaterial({color:0x08235f,roughness:.31,metalness:.06,clearcoat:.5});
 const rings:number[][][]=[];for(let j=0;j<=220;j++){const z=-19.735+39.47*j/220,[rx,ry,cy]=profile(z);const ring=[];for(let i=0;i<=80;i++){const a=i/80*Math.PI*2;ring.push([rx*Math.sin(a),cy+ry*Math.cos(a),z]);}rings.push(ring);}this.cockpitHidden.push(mesh(this.group,loft(rings),bodyPaint,'smooth fuselage and radome'));
 // Subtle curved seams, without painting a dark stripe through the windows.
 for(const z of [-18.3,-14.5,10.8,15.7]){const [rx,ry,cy]=profile(z);const p=[];for(let i=0;i<100;i++){const a=i/100*Math.PI*2;p.push(new THREE.Vector3((rx+.009)*Math.sin(a),cy+(ry+.009)*Math.cos(a),z));}line(this.group,p,seam,true);}
 const windowGlass:THREE.BufferGeometry[]=[],windowFrames:THREE.BufferGeometry[]=[];
 for(const side of [-1,1]){
  for(let i=0;i<44;i++){const z=-12.8+i*.57;if(Math.abs(z+.1)<.57||Math.abs(z-1.2)<.5)continue;windowFrames.push(surfaceShape(roundRect(.285,.465,.11),z,.60,side,.012));windowGlass.push(surfaceShape(roundRect(.235,.415,.095),z,.60,side,.023));}
  // Passenger doors, overwing exits, handles and cargo hatches follow the fuselage.
  for(const [z,w,h,y] of [[-14.2,.85,1.78,.12],[12.4,.85,1.78,.12],[-.15,.59,1.05,.43],[1.15,.59,1.05,.43],[-9.8,1.4,.86,-.98],[8.4,1.6,.88,-.96]]){const shape=roundRect(w,h,.11);line(this.group,shape.getPoints(10).map(p=>surfacePoint(z+p.x,y+p.y,side,.017)),seam,true);const a=surfacePoint(z+.22,y+.12,side,.029),b=surfacePoint(z+.03,y+.12,side,.029);tube(this.group,a,b,.018,metal);}

 }
 this.cockpitHidden.push(mesh(this.group,mergeGeometries(windowFrames),frame,'rounded cabin window frames'),mesh(this.group,mergeGeometries(windowGlass),glass,'cabin and cockpit glazing'));
 // Six individually fitted panes wrap around a narrow center windshield pillar.
 const cockpit=new THREE.Group();cockpit.name='cockpit windshield assembly';this.group.add(cockpit);this.cockpitHidden.push(cockpit);
 const cockpitGlass=new THREE.MeshPhysicalMaterial({color:0x071722,metalness:0,roughness:.24,clearcoat:.22,clearcoatRoughness:.3,reflectivity:.22,envMapIntensity:.32,side:THREE.DoubleSide});
 const bezel=new THREE.MeshStandardMaterial({color:0x69777e,metalness:.45,roughness:.4,side:THREE.DoubleSide});
 const seal=new THREE.MeshStandardMaterial({color:0x10171c,roughness:.85,side:THREE.DoubleSide});
 // Coordinates are longitudinal position / angle from the fuselage crown.
 const panes=[
  [[-18.18,.035],[-17.39,.035],[-16.82,.735],[-17.48,1.005]],
  [[-17.27,1.07],[-16.66,.79],[-15.94,.86],[-15.88,1.145]],
  [[-15.72,1.16],[-15.78,.90],[-15.28,.99],[-15.16,1.16]]
 ];
 for(const side of [-1,1]){
  panes.forEach((points,i)=>{
   const name=`${side<0?'port':'starboard'} cockpit pane ${i+1}`;
   const rim=mesh(cockpit,cockpitShape(points,1.055,side,.025),bezel,`${name} frame`);
   const gasket=mesh(cockpit,cockpitShape(points,1.025,side,.042),seal,`${name} seal`);
   const pane=mesh(cockpit,cockpitShape(points,.965,side,.061),cockpitGlass,name);
   for(const detail of [rim,gasket,pane]){detail.castShadow=false;detail.receiveShadow=false;}
  });
  // Parked wiper arms sit just below the two forward windscreens.
  const wiperBase=cockpitPoint(-17.78,.59,side,.10),wiperJoint=cockpitPoint(-17.78,.30,side,.10),wiperTip=cockpitPoint(-17.84,.12,side,.10);
  tube(cockpit,wiperBase,wiperJoint,.013,seal);tube(cockpit,wiperJoint,wiperTip,.022,seal);
 }
 // Belly fairing blends the swept wing root into the fuselage.
 const fairing=mesh(this.group,new THREE.SphereGeometry(1,48,24),bluePaint,'wing-body fairing');fairing.scale.set(2.28,.69,5.2);fairing.position.set(0,-1.48,1.1);
 for(const side of [-1,1]){
  const wg=new THREE.Group();this.group.add(wg);this.wings.push(wg);
  const rows=[[1.35,-.83,-4.1,8.25,.115],[3.4,-.72,-3.3,6.55,.115],[6.5,-.47,-1.55,4.7,.105],[11,-.05,1.28,2.83,.09],[16.6,.43,4.48,1.29,.075]];
  mesh(wg,wingGeometry(rows,side,.125,.755),wingPaint,'swept airfoil');
  // Polished leading-edge slats, spanning the curved front of the wing.
  mesh(wg,wingGeometry(rows,side,0,.12),metal,'leading-edge slats');
  // A curved blended winglet, rather than a vertical rectangular plate.
  const wingletRows=[[16.50,.43,4.50,1.31,.075],[16.95,.54,4.68,1.2,.075],[17.30,.86,4.94,1.04,.075],[17.52,1.38,5.23,.89,.075],[17.65,2.15,5.66,.67,.075],[17.78,3.05,6.08,.43,.07],[17.895,3.42,6.27,.24,.07]];
  mesh(wg,wingGeometry(wingletRows,side),paint,'blended winglet');
  // Separate trailing-edge panels leave real gaps instead of overlapping the wing.
  const rowAt=(x:number)=>{let i=0;while(i<rows.length-2&&rows[i+1][0]<x)i++;const t=(x-rows[i][0])/(rows[i+1][0]-rows[i][0]);return rows[i].map((v,k)=>v+(rows[i+1][k]-v)*t);};
  const trailing=(x0:number,x1:number,name:string)=>{const a=rowAt(x0),pivot=new THREE.Group();pivot.position.set(side*x0,a[1],a[2]+a[3]*.765);wg.add(pivot);const xs=[x0,...rows.map(r=>r[0]).filter(x=>x>x0&&x<x1),x1];const panelRows=xs.map(x=>{const r=rowAt(x);return[x-x0,r[1]-a[1],r[2]+r[3]*.765-pivot.position.z,r[3]*.235,.095];});mesh(pivot,wingGeometry(panelRows,side),wingPaint,name);return pivot;};
  trailing(1.35,2.85,'fixed wing-root trailing edge');trailing(15.7,16.6,'fixed wingtip trailing edge');
  for(const [x0,x1] of [[2.9,6.25],[6.3,10.75]]){this.flaps.push(trailing(x0,x1,'trailing-edge flap'));const r=rowAt(x1-.45),track=mesh(wg,new THREE.SphereGeometry(1,20,10),paint,'flap track fairing');track.scale.set(.16,.20,1.55);track.position.set(side*(x1-.45),r[1]-.28,r[2]+r[3]*.83);}
  this.ailerons.push(trailing(10.8,15.65,'aileron'));
  const upper=(x:number,u:number)=>{const r=rowAt(x),t=5*r[4]*(.2969*Math.sqrt(u)-.126*u-.3516*u*u+.2843*u**3-.1036*u**4);return new THREE.Vector3(side*x,r[1]+r[3]*(t+.015*Math.sin(u*Math.PI))+.045,r[2]+r[3]*u);};
  for(let j=0;j<3;j++){const x=3.1+j*2.2,origin=upper(x,.50),pivot=new THREE.Group();pivot.position.copy(origin);wg.add(pivot);const points=[upper(x,.50),upper(x+1.8,.50),upper(x+1.8,.70),upper(x,.70)].map(p=>p.sub(origin));mesh(pivot,geometry(points.flatMap(p=>p.toArray()),[0,2,1,0,3,2]),wingPaint,'ground spoiler');this.spoilers.push(pivot);}
  // Horizontal tail with a distinct hinged elevator.
  mesh(this.group,wingGeometry([[.7,1.0,12.4,4.15,.10],[2.8,1.16,13.6,2.9,.09],[7.1,1.5,16.4,1.13,.07]],side),wingPaint,'horizontal stabilizer');
  const elevator=new THREE.Group();elevator.position.set(side*.9,1.03,15.45);this.group.add(elevator);mesh(elevator,wingGeometry([[0,0,0,.86,.06],[5.7,.41,1.56,.47,.06]],side),wingPaint,'elevator');this.elevators.push(elevator);
  // CFM56-style nacelle, with the characteristic flattened lower intake.
  const engine=new THREE.Group();engine.position.set(side*5.05,-1.63,-4.45);wg.add(engine);
  const engineRings=[];for(const [z,rx,ry] of [[-2.05,1.04,.98],[-1.90,1.13,1.05],[-1.35,1.16,1.08],[-.1,1.09,1.03],[1.15,.90,.88],[1.85,.67,.66]]){const ring=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;ring.push([Math.sin(a)*rx,Math.max(-.90,Math.cos(a)*ry),z]);}engineRings.push(ring);}mesh(engine,loft(engineRings,false),paint,'engine nacelle');
  for(const [z,rx,ry] of [[-1.35,1.17,1.09],[1.15,.912,.892]]){const seamPoints=[];for(let i=0;i<80;i++){const a=i/80*Math.PI*2;seamPoints.push(new THREE.Vector3(Math.sin(a)*rx,Math.max(-.914,Math.cos(a)*ry),z));}line(engine,seamPoints,seam,true);}
  const lipRings=[];for(const [z,r] of [[-1.82,.88],[-2.03,.91],[-2.13,.98],[-2.08,1.04],[-1.92,1.105]]){const ring=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;ring.push([Math.sin(a)*r,Math.max(-.91,Math.cos(a)*r*.95),z]);}lipRings.push(ring);}mesh(engine,loft(lipRings,false),metal,'polished intake lip');
  const duct=mesh(engine,new THREE.CylinderGeometry(.895,.88,.75,48,1,true),darkMetal,'intake duct');duct.rotation.x=Math.PI/2;duct.position.z=-1.55;
  const fan=new THREE.Group();fan.position.z=-1.65;engine.add(fan);this.fans.push(fan);
  const fanBack=mesh(fan,new THREE.CircleGeometry(.865,64),rubber);fanBack.rotation.y=Math.PI;
  for(let blade=0;blade<28;blade++){const a=blade/28*Math.PI*2;const pts=[];for(const [r,angle,z] of [[.20,a,0],[.84,a+.19,-.065],[.86,a+.35,-.055],[.28,a+.14,.035]])pts.push(Math.sin(angle)*r,Math.cos(angle)*r,z);mesh(fan,geometry(pts,[0,2,1,0,3,2]),darkMetal,'fan blade');}
  batchChildren(fan,darkMetal);
  const spinner=mesh(fan,new THREE.ConeGeometry(.235,.46,32),metal,'fan spinner');spinner.rotation.x=-Math.PI/2;spinner.position.z=-.17;
  const spiral=[];for(let i=0;i<=48;i++){const t=i/48,r=.012+t*.20,a=t*Math.PI*3;spiral.push(new THREE.Vector3(Math.sin(a)*r,Math.cos(a)*r,-.40+t*.41));}line(fan,spiral,new THREE.LineBasicMaterial({color:0xf1f3ed}));
  const exhaust=mesh(engine,new THREE.CylinderGeometry(.61,.43,1.0,40,1,true),darkMetal,'exhaust nozzle');exhaust.rotation.x=Math.PI/2;exhaust.position.z=1.75;
  const plug=mesh(engine,new THREE.ConeGeometry(.32,.9,32),metal,'exhaust plug');plug.rotation.x=Math.PI/2;plug.position.z=2.03;
  const sleeve=new THREE.Group();engine.add(sleeve);this.reversers.push(sleeve);for(const sideX of [-1,1]){const panel=mesh(sleeve,new THREE.BoxGeometry(.025,.9,.55),darkMetal,'reverse thrust cascade');panel.position.set(sideX*.94,-.02,.76);}
  const pylon=mesh(wg,new THREE.SphereGeometry(1,24,12),paint,'engine pylon');pylon.scale.set(.28,.70,1.9);pylon.position.set(side*5.05,-.95,-3.65);
  const bulb=mesh(wg,new THREE.SphereGeometry(.065,12,8),new THREE.MeshBasicMaterial({color:side<0?0xf3483f:0x66ffc5}),'navigation light');bulb.position.set(side*17.68,2.95,6.05);
 }
 // A dorsal fillet and curved fin with a separate rudder.
 const finRings=[[0,1.2,9.3,8.5,.075],[.0,2.4,11.25,6.05,.075],[0,4.3,13.05,4.05,.08],[0,7.9,15.4,1.98,.09],[0,8.65,15.8,1.5,.08]];
 const finGeo=loft(finRings.map(([,y,z,chord,t])=>{const ring=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,u=(1-Math.cos(a))*.5;ring.push([Math.sin(a)*chord*t*.5,y,z+u*chord]);}return ring;}));mesh(this.group,finGeo,tailPaint,'vertical stabilizer');
 this.rudder.position.set(0,2.3,16.70);this.group.add(this.rudder);mesh(this.rudder,loft([[[-.035,0,0],[.035,0,0],[.035,0,.65],[-.035,0,.65],[-.035,0,0]],[[-.02,6.2,0],[.02,6.2,0],[.02,6.2,.48],[-.02,6.2,.48],[-.02,6.2,0]]]),bluePaint,'rudder');
 // Conformal lettering stays legible on both sides without mirrored text.
 const wordmark=new THREE.MeshStandardMaterial({map:aircraftLettering('boeing'),color:0xffffff,transparent:true,alphaTest:.12,roughness:.43,side:THREE.DoubleSide,depthWrite:false});
 const tailMark=wordmark.clone();tailMark.map=aircraftLettering('737');

 const labels=new THREE.Group();labels.name='Boeing livery lettering';this.group.add(labels);this.cockpitHidden.push(labels);
 for(const side of [-1,1]){
  const text=mesh(labels,labelSurface(6.5,.8,side,(u,v)=>surfacePoint(-9.7+u,-.52+v,side,.032)),wordmark,'BOEING wordmark');text.castShadow=false;text.receiveShadow=false;
  const tailSurface=(u:number,v:number)=>{const z=15.3+u,y=3.25+v;let i=0;while(i<finRings.length-2&&finRings[i+1][1]<y)i++;const a=finRings[i],b=finRings[i+1],t=(y-a[1])/(b[1]-a[1]),leading=a[2]+(b[2]-a[2])*t,chord=a[3]+(b[3]-a[3])*t,thickness=a[4]+(b[4]-a[4])*t,f=THREE.MathUtils.clamp((z-leading)/chord,0,1);return new THREE.Vector3(side*(chord*thickness*Math.sqrt(f*(1-f))+.022),y,z);};
  const label=mesh(labels,labelSurface(2.2,.95,side,tailSurface),tailMark,'737 tail marking');label.castShadow=false;label.receiveShadow=false;
 }
 // Retraction pivots preserve wheel proportions throughout gear travel.
 this.group.add(this.gear,this.noseGear);
 const wheel=(parent:THREE.Group,x:number,y:number,z:number,r:number)=>{const assembly=new THREE.Group();assembly.position.set(x,y,z);parent.add(assembly);const tire=mesh(assembly,new THREE.TorusGeometry(r*.72,r*.28,14,32),rubber,'tire');tire.rotation.y=Math.PI/2;const hub=mesh(assembly,new THREE.CylinderGeometry(r*.44,r*.44,r*.57,24),metal,'wheel hub');hub.rotation.z=Math.PI/2;for(const side of [-1,1])for(let k=0;k<8;k++){const a=k/8*Math.PI*2;const bolt=mesh(assembly,new THREE.SphereGeometry(.022,6,4),darkMetal);bolt.position.set(side*r*.3,Math.sin(a)*r*.3,Math.cos(a)*r*.3);}batchChildren(assembly,darkMetal);this.wheels.push(assembly);};
 for(const side of [-1,1]){const pivot=new THREE.Group();pivot.position.set(side*2.85,-1.15,3.2);this.gear.add(pivot);this.mains.push(pivot);tube(pivot,new THREE.Vector3(0,0,0),new THREE.Vector3(0,-1.79,0),.115,metal);tube(pivot,new THREE.Vector3(side*.62,.10,-.62),new THREE.Vector3(0,-1.24,0),.068,darkMetal);tube(pivot,new THREE.Vector3(0,-.52,-.11),new THREE.Vector3(0,-1.05,-.29),.035,metal);tube(pivot,new THREE.Vector3(0,-1.05,-.29),new THREE.Vector3(0,-1.39,-.1),.035,metal);for(const w of [-1,1])wheel(pivot,w*.32,-1.79,0,.56);const door=new THREE.Group();door.position.set(side*1.85,-1.73,2.9);this.group.add(door);const panel=mesh(door,new THREE.BoxGeometry(.68,.06,1.4),paint,'main gear door');panel.position.x=side*.3;this.doors.push(door);}
 this.noseGear.position.set(0,-1.36,-13.0);tube(this.noseGear,new THREE.Vector3(0,0,0),new THREE.Vector3(0,-1.77,0),.08,metal);tube(this.noseGear,new THREE.Vector3(0,-.12,.75),new THREE.Vector3(0,-1.15,0),.055,darkMetal);for(const side of [-1,1])wheel(this.noseGear,side*.22,-1.77,0,.37);
 for(const side of [-1,1]){const door=mesh(this.group,new THREE.BoxGeometry(.32,.035,1.25),paint,'nose gear door');door.position.set(side*.42,-1.86,-12.8);door.rotation.z=side*.55;}
 // Beacon lenses, antennas and landing lights finish the silhouette.
 for(const y of [1.99,-1.98]){const light=mesh(this.group,new THREE.SphereGeometry(.075,12,8),new THREE.MeshBasicMaterial({color:0xff3528}),'anti-collision beacon');light.position.set(0,y,2.8);this.beacons.push(light);}
 for(const z of [-5.5,7]){const antenna=mesh(this.group,new THREE.ConeGeometry(.14,.48,3),paint,'VHF antenna');antenna.scale.z=2.2;antenna.position.set(0,2.14,z);}
 for(const side of [-1,1]){const light=mesh(this.group,new THREE.CircleGeometry(.115,16),new THREE.MeshBasicMaterial({color:0xfff2d2}),'landing light');light.rotation.y=Math.PI;light.position.set(side*2.0,-.47,-3.89);}
 this.group.userData={type:'737-800',length:39.47,wingspan:35.79};
 }
 setCockpitView(active:boolean){this.cockpitHidden.forEach(o=>o.visible=!active);this.group.traverse(o=>{if(o instanceof THREE.Line)o.visible=!active;});}
 update(s:FlightState,dt:number){if(s.paused)dt=0;const k=1-Math.exp(-dt*3);this.flapAngle+=(FLAPS[s.flaps]*D-this.flapAngle)*Math.min(1,dt*.8);const retract=1-s.gearPosition;this.gearAngle=retract*Math.PI/2;this.mains.forEach((g,i)=>{g.rotation.z=(i===0?1:-1)*this.gearAngle;});this.noseGear.rotation.x=-this.gearAngle;this.noseGear.rotation.y=(s.onGround?s.controlYaw:0)*.32;this.gear.visible=this.noseGear.visible=s.gearPosition>.025;this.doors.forEach((g,i)=>{g.rotation.z=(i===0?-1:1)*(1-retract)*1.2;});
 this.flaps.forEach(g=>{g.rotation.x=this.flapAngle;g.position.z=g.userData.baseZ??(g.userData.baseZ=g.position.z);g.position.z+=this.flapAngle*.85;});this.ailerons.forEach((g,i)=>g.rotation.x+=((i===0?-1:1)*s.controlRoll*.28-g.rotation.x)*(1-Math.exp(-dt*9)));this.elevators.forEach(g=>g.rotation.x+=(-s.controlPitch*.3-g.rotation.x)*(1-Math.exp(-dt*9)));this.rudder.rotation.y+=(-s.controlYaw*.32-this.rudder.rotation.y)*(1-Math.exp(-dt*7));this.spoilers.forEach(g=>{g.rotation.x+=((s.touchdown&&(s.brake||s.reverse)?-1.05:0)-g.rotation.x)*k;});
 this.wheelTravel+=s.onGround?s.speed*dt:0;this.wheels.forEach(g=>g.rotation.x=this.wheelTravel/(g.parent===this.noseGear?.37:.56));this.fanAngle+=(4+s.n1*1.4)*dt;this.fans.forEach(g=>g.rotation.z=this.fanAngle);this.reversers.forEach(g=>{g.visible=s.reverse&&s.onGround;g.position.z=g.visible?.32:0;});const flex=s.onGround?0:Math.min(.013,s.speed*.00009);this.wingFlex+=(flex-this.wingFlex)*k;this.wings.forEach((g,i)=>g.rotation.z=(i===0?-1:1)*this.wingFlex);this.beacons.forEach((g,i)=>{g.visible=s.running&&Math.sin(s.elapsed*6+i*2)>.45;});}
}
