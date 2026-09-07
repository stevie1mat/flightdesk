// Offline conversion of the MIT-licensed Rocketbox assets; source paths in CREDITS.md.
import fs from 'node:fs';
import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
THREE.TextureLoader.prototype.load=function(){return new THREE.Texture();};
const manager=new THREE.LoadingManager();manager.addHandler(/\.tga$/i,{setPath(){return this;},load:()=>new THREE.Texture()});
globalThis.FileReader=class{async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.();}};
const load=file=>{const b=fs.readFileSync(file);return new FBXLoader(manager).parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const walk=load('/private/tmp/flight-rocket-walk.fbx').animations[0];
for(const [index,name] of [[2,'traveler-man'],[3,'traveler-woman']]){
 const root=load(`/private/tmp/flight-rocket-${index}.fbx`);root.animations=[];root.children.filter(o=>o.isLight).forEach(o=>root.remove(o));
 root.traverse(o=>{if(o.isMesh){const geometry=o.geometry,groups=[...geometry.groups],indices=[];geometry.clearGroups();for(const materialIndex of [...new Set(groups.map(g=>g.materialIndex))]){const start=indices.length;for(const group of groups.filter(g=>g.materialIndex===materialIndex))for(let i=group.start;i<group.start+group.count;i++)indices.push(geometry.index?geometry.index.getX(i):i);geometry.addGroup(start,indices.length-start,materialIndex);}geometry.setIndex(indices);o.material=(Array.isArray(o.material)?o.material:[o.material]).map(m=>new THREE.MeshStandardMaterial({name:m.name,roughness:.82}));}});
 const tracks=walk.tracks.filter(t=>t.name.endsWith('.quaternion')&&root.getObjectByName(t.name.split('.')[0])).map(t=>t.clone());
 const clip=new THREE.AnimationClip('Walk',walk.duration,tracks),mixer=new THREE.AnimationMixer(root);mixer.clipAction(clip).play();
 const hips=root.getObjectByName('Bip01'),base=hips.position.clone(),times=[],values=[],point=new THREE.Vector3();
 // Bake floor contact from the actual skinned sole vertices; no floating cube limbs.
 for(let i=0;i<=60;i++){const t=clip.duration*i/60;mixer.setTime(Math.min(t,clip.duration-.00001));root.updateMatrixWorld(true);let low=Infinity;
 root.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();const pos=o.geometry.attributes.position;for(let n=0;n<pos.count;n++){o.getVertexPosition(n,point).applyMatrix4(o.matrixWorld);low=Math.min(low,point.y);}}});
 times.push(t);values.push(base.x,base.y-low,base.z);
 }
 values.splice(values.length-3,3,...values.slice(0,3));clip.tracks.push(new THREE.VectorKeyframeTrack('Bip01.position',times,values));mixer.stopAllAction();mixer.uncacheRoot(root);hips.position.copy(base);root.updateMatrixWorld(true);
 const data=await new GLTFExporter().parseAsync(root,{binary:true,animations:[clip],onlyVisible:true});fs.writeFileSync(`public/assets/people/${name}.glb`,Buffer.from(data));console.log(name,data.byteLength,'bytes',tracks.length,'joint tracks');
}
