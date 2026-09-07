import * as THREE from 'three';
import type {FlightState} from './physics';

export function nightAmount(hour:number){const elevation=Math.sin((hour-6)*Math.PI/12);return 1-THREE.MathUtils.smoothstep(elevation,-.12,.12);}
const pointVertex=`attribute vec3 color;varying vec3 vColor;varying float vDistance;uniform float brightness;uniform float scale;void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.);vDistance=-p.z;gl_Position=projectionMatrix*p;gl_PointSize=clamp(scale/max(1.,-p.z),2.,24.);}`;
const pointFragment=`varying vec3 vColor;varying float vDistance;uniform float brightness;uniform float fogDensity;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float glow=exp(-r*r*8.)+.4*exp(-r*r*70.);gl_FragColor=vec4(vColor*brightness,glow*exp(-max(0.,vDistance)*fogDensity));}`;

// Batched light sprites and painted light pools keep the night scene affordable.
export class NightEnvironment {
 private lights:THREE.Points;private lightMaterial:THREE.ShaderMaterial;
 private stars:THREE.Points;private starMaterial:THREE.PointsMaterial;
 private pools:THREE.InstancedMesh;private poolMaterial:THREE.MeshBasicMaterial;
 private navigation:THREE.Points;private landing:THREE.SpotLight[]=[];private moon:THREE.Mesh;
 private sky:THREE.Mesh;private skyMaterial:THREE.ShaderMaterial;
 constructor(scene:THREE.Scene,aircraft:THREE.Group){
  const positions:number[]=[],colors:number[]=[];
  const bulb=(x:number,y:number,z:number,color:number)=>{positions.push(x,y,z);const c=new THREE.Color(color);colors.push(c.r,c.g,c.b);};
  const poolPositions:{x:number;z:number;size:number;color:number}[]=[];
  for(const airport of [0,-25000]){
   // White runway edges, amber at the far end; inset centerline and thresholds.
   for(let z=-1470;z<=1470;z+=30){
    for(const x of [-31,31])bulb(x,.55,airport+z,z<-900?0xffbd55:0xffefd4);
    bulb(0,.25,airport+z,z<-1200?0xff3b32:z<-600&&(z/30)%2===0?0xff5d47:0xf2f5ff);
    for(const x of [124,146])bulb(x,.5,airport+z,0x397dff);
    bulb(135,.25,airport+z,0x37ec9e);
   }
   for(let x=-27;x<=27;x+=3){bulb(x,.35,airport+1485,0x48ff93);bulb(x,.35,airport-1485,0xff3b32);}
   for(let z=1530;z<=2190;z+=30){bulb(0,.7,airport+z,0xffefd4);if(z===1800)for(let x=-30;x<=30;x+=5)bulb(x,.7,airport+z,0xffefd4);}
   for(const dz of [-1200,-500,200,900])for(let x=40;x<135;x+=15)bulb(x,.4,airport+dz,0x37ec9e);
   for(let i=0;i<5;i++){const z=airport-500+i*155;bulb(225,19,z,0xffe1a4);poolPositions.push({x:230,z,size:65,color:0xffe6b0});}
   for(let z=-1450;z<1500;z+=120)poolPositions.push({x:135,z:airport+z,size:10,color:0x467dff});
   poolPositions.push({x:200,z:airport+1018,size:34,color:0xffd6a0});
  }
  // Street lamps follow the existing city grid; no per-lamp shadow maps.
  for(let row=0;row<110;row++)for(let col=1;col<17;col++){const x=1645+col*310,z=3455-row*310;bulb(x,7,z,0xffcd81);if(row%3===0&&col<9)poolPositions.push({x,z,size:24,color:0xffc376});}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  this.lightMaterial=new THREE.ShaderMaterial({vertexShader:pointVertex,fragmentShader:pointFragment,uniforms:{brightness:{value:0},scale:{value:1100},fogDensity:{value:.000012}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  this.lights=new THREE.Points(geo,this.lightMaterial);scene.add(this.lights);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;const gradient=ctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(255,255,255,.6)');gradient.addColorStop(.3,'rgba(255,255,255,.22)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  this.poolMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0,toneMapped:false});
  this.pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),this.poolMaterial,poolPositions.length);const dummy=new THREE.Object3D();
  poolPositions.forEach((p,i)=>{dummy.position.set(p.x,.31,p.z);dummy.rotation.x=-Math.PI/2;dummy.scale.set(p.size,p.size,1);dummy.updateMatrix();this.pools.setMatrixAt(i,dummy.matrix);this.pools.setColorAt(i,new THREE.Color(p.color));});scene.add(this.pools);
  this.skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{night:{value:1}},vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 direction;void main(){float h=max(0.,normalize(direction).y);vec3 c=mix(vec3(.024,.038,.069),vec3(.002,.005,.016),pow(h,.45));gl_FragColor=vec4(c,1.);}'});
  this.sky=new THREE.Mesh(new THREE.SphereGeometry(70000,32,16),this.skyMaterial);this.sky.renderOrder=-10;scene.add(this.sky);
  const starPositions:number[]=[];let seed=238;const rand=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  for(let i=0;i<1600;i++){const az=rand()*Math.PI*2,y=.08+rand()*.92,r=Math.sqrt(1-y*y);starPositions.push(Math.cos(az)*r*65000,y*65000,Math.sin(az)*r*65000);}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));this.starMaterial=new THREE.PointsMaterial({color:0xccddff,size:1.3,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,toneMapped:false});this.stars=new THREE.Points(starGeo,this.starMaterial);scene.add(this.stars);
  this.moon=new THREE.Mesh(new THREE.SphereGeometry(340,24,16),new THREE.MeshBasicMaterial({color:0xb6c9df,toneMapped:false}));scene.add(this.moon);
  const navGeo=new THREE.BufferGeometry();navGeo.setAttribute('position',new THREE.Float32BufferAttribute([-17.68,2.95,6.05,17.68,2.95,6.05,0,.7,19.7],3));navGeo.setAttribute('color',new THREE.Float32BufferAttribute([1,.05,.025,.03,1,.35,1,1,1],3));this.navigation=new THREE.Points(navGeo,this.lightMaterial);aircraft.add(this.navigation);
  const poleMaterial=new THREE.MeshStandardMaterial({color:0x56616b,metalness:.6,roughness:.6});const poles=new THREE.InstancedMesh(new THREE.CylinderGeometry(.14,.24,19,6),poleMaterial,10);let poleIndex=0;for(const airport of [0,-25000])for(let i=0;i<5;i++){dummy.position.set(225,9.5,airport-500+i*155);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();poles.setMatrixAt(poleIndex++,dummy.matrix);}scene.add(poles);
  for(const side of [-1,1]){const spot=new THREE.SpotLight(0xf4f2df,0,360,.19,.65,2);spot.position.set(side*2,-.45,-3.9);spot.target.position.set(side*2,-8,-160);spot.castShadow=false;aircraft.add(spot,spot.target);this.landing.push(spot);}
 }
 update(s:FlightState,camera:THREE.Camera,pixelRatio:number){
  const night=nightAmount(s.time),clear=s.weather==='Clear';
  this.navigation.visible=this.lights.visible=this.pools.visible=night>.01;this.lightMaterial.uniforms.fogDensity.value=s.weather==='Fog'?.00065:s.weather==='Rain'?.00016:.000012;this.lightMaterial.uniforms.brightness.value=night*(s.weather==='Fog'?.55:1);this.lightMaterial.uniforms.scale.value=1100*pixelRatio;this.poolMaterial.opacity=night*.45;
  this.sky.visible=night>.95;this.sky.position.copy(camera.position);
  this.stars.visible=night>.95&&clear;this.stars.position.copy(camera.position);this.starMaterial.opacity=night*.7;
  this.moon.visible=night>.95&&clear;this.moon.position.copy(camera.position).add(new THREE.Vector3(-28000,34000,-38000));
  this.landing.forEach(light=>{light.intensity=night*(s.gear||s.onGround?45000:0);});
 }
 dispose(){this.poolMaterial.map?.dispose();}
}
