import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {PilotState} from './pilot';

type Walker={group:THREE.Group;model:THREE.Object3D;mixer:THREE.AnimationMixer;angle:number;airport:number;speed:number;shadow:THREE.Mesh};
// Textured, skinned Rocketbox travelers. Geometry/materials are shared between clones.
export class AirportPeople{
 readonly group=new THREE.Group();readonly player=new THREE.Group();private playerMixer:THREE.AnimationMixer|null=null;private playerWalk:THREE.AnimationAction|null=null;private playerIdle:THREE.AnimationAction|null=null;private playerDistance=0;private walkers:Walker[]=[];private disposed=false;private templates:THREE.Object3D[]=[];private lastTime:number|null=null;
 private shadowGeometry=new THREE.PlaneGeometry(.85,.65);private shadowMaterial:THREE.MeshBasicMaterial;
 constructor(scene:THREE.Scene,manager:THREE.LoadingManager){
  scene.add(this.group);this.group.add(this.player);this.player.name='Playable pilot';this.player.visible=false;this.group.name='Airport travelers';
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,'rgba(0,0,0,.5)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  this.shadowMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,toneMapped:false});
  const loader=new GLTFLoader(manager),textures=new THREE.TextureLoader(manager);
  for(const [variant,prefix] of [['traveler-man','m002'],['traveler-woman','f001']]){
   const maps=new Map<string,THREE.Texture>();
   const texture=(part:string,color=true)=>{if(maps.has(part))return maps.get(part)!;const t=textures.load(`/assets/people/${prefix}_${part}.webp`);t.flipY=true;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=4;maps.set(part,t);return t;};
   // Queue textures together with the model so the existing loading indicator covers them.
   for(const part of ['body_color','head_color','opacity_color'])texture(part);for(const part of ['body_normal','head_normal'])texture(part,false);
   loader.load(`/assets/people/${variant}.glb`,gltf=>{
    if(this.disposed){gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});maps.forEach(t=>t.dispose());return;}
    this.templates.push(gltf.scene);gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
     const prepare=(old:THREE.Material)=>{const part=old.name.includes('opacity')?'opacity':old.name.includes('head')?'head':'body';old.dispose();const material=new THREE.MeshStandardMaterial({name:`${variant} ${part}`,map:texture(`${part}_color`),roughness:part==='head'?.75:.9,metalness:0,side:part==='opacity'?THREE.DoubleSide:THREE.FrontSide,alphaTest:part==='opacity'?.42:0});if(part!=='opacity'){material.normalMap=texture(`${part}_normal`,false);material.normalScale.set(.45,.45);}return material;};
     o.material=Array.isArray(o.material)?o.material.map(prepare):prepare(o.material);o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;
    });
    const walk=gltf.animations.find(c=>c.name==='Walk');if(!walk)return;
    if(prefix==='m002'){
     const model=clone(gltf.scene);model.scale.setScalar(.01);this.player.add(model);this.playerMixer=new THREE.AnimationMixer(model);
     const tracks=walk.tracks.map(t=>{const interpolant=t.name.endsWith('.quaternion')?new THREE.QuaternionLinearInterpolant(t.times,t.values,4):new THREE.LinearInterpolant(t.times,t.values,3);if(t.name.endsWith('.quaternion')){const a=new THREE.Quaternion().fromArray(interpolant.evaluate(0)),b=new THREE.Quaternion().fromArray(interpolant.evaluate(walk.duration/2));return new THREE.QuaternionKeyframeTrack(t.name,[0],a.slerp(b,.5).toArray());}return new THREE.VectorKeyframeTrack(t.name,[0],Array.from(interpolant.evaluate(0)));});
     const idle=new THREE.AnimationClip('Standing',1,tracks);this.playerIdle=this.playerMixer.clipAction(idle).play();this.playerMixer.update(0);model.updateMatrixWorld(true);
     let low=Infinity;const vertex=new THREE.Vector3();model.traverse(o=>{if(o instanceof THREE.SkinnedMesh){o.skeleton.update();for(let j=0;j<o.geometry.attributes.position.count;j++){o.getVertexPosition(j,vertex).applyMatrix4(o.matrixWorld);low=Math.min(low,vertex.y);}}});const hips=idle.tracks.find(t=>t.name==='Bip01.position');if(hips)hips.values[1]-=low/.01;
     this.playerWalk=this.playerMixer.clipAction(walk).play();this.playerWalk.setEffectiveWeight(0);
    }

    for(const airport of [0,-25000])for(let i=0;i<2;i++){
     const model=clone(gltf.scene);model.scale.setScalar(.01);const group=new THREE.Group();group.name=variant;group.add(model);this.group.add(group);
     const mixer=new THREE.AnimationMixer(model);mixer.clipAction(walk).play();mixer.setTime((i+(prefix==='f001'?.5:0))*.31);
     const shadow=new THREE.Mesh(this.shadowGeometry,this.shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;group.add(shadow);
     this.walkers.push({group,model,mixer,shadow,airport,angle:i*Math.PI+(prefix==='f001'?Math.PI/2:0),speed:prefix==='f001'?1.05:1.15});
    }
   },undefined,()=>{maps.forEach(t=>t.dispose());});
  }
 }
 update(time:number,night:number,camera:THREE.Camera,paused:boolean){const dt=this.lastTime===null?0:Math.min(.1,time-this.lastTime);this.lastTime=time;this.shadowMaterial.opacity=1-night*.7;
  for(const w of this.walkers){if(!paused)w.angle+=dt*w.speed/Math.hypot(23*Math.sin(w.angle),7*Math.cos(w.angle));const x=90+23*Math.cos(w.angle),z=w.airport+1120+7*Math.sin(w.angle);w.group.position.set(x,Math.abs(x-90)<17&&z-w.airport<1113.5?.155:.015,z);w.group.rotation.y=Math.atan2(-23*Math.sin(w.angle),7*Math.cos(w.angle));
   const near=camera.position.distanceToSquared(w.group.position)<500*500;w.group.visible=near;if(near&&!paused)w.mixer.update(dt*w.speed/1.1);
  }
 }
 updatePilot(p:PilotState|null,dt:number,camera:THREE.Camera){this.player.visible=!!p?.active&&p.view==='Third person'&&camera.position.distanceTo(new THREE.Vector3(p.x,p.y-.18,p.z))>.45;if(!p)return;this.player.position.set(p.x,p.feetY,p.z);this.player.rotation.y=Math.PI-p.bodyHeading;const distance=Math.max(0,p.walked-this.playerDistance);this.playerDistance=p.walked;if(!this.playerMixer||!this.playerWalk||!this.playerIdle)return;this.playerWalk.setEffectiveWeight(p.moving?1:0);this.playerIdle.setEffectiveWeight(p.moving?0:1);if(p.moving)this.playerWalk.timeScale=Math.min(4,distance/Math.max(dt,.001)/1.1);this.playerMixer.update(dt);}
 dispose(){this.disposed=true;this.playerMixer?.stopAllAction();this.playerMixer?.uncacheRoot(this.player.children[0]??this.player);this.player.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.dispose();});for(const w of this.walkers){w.mixer.stopAllAction();w.mixer.uncacheRoot(w.model);w.model.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.dispose();});}const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();this.templates.forEach(g=>g.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}}}));geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.shadowGeometry.dispose();this.shadowMaterial.map?.dispose();this.shadowMaterial.dispose();this.group.removeFromParent();}
}
