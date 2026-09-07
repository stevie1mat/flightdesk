import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import { initialState } from '../lib/flight/physics.ts';
// Transpile only this self-contained model; no browser or GPU is required.
const source=fs.readFileSync(new URL('../lib/flight/aircraft.ts',import.meta.url),'utf8');
const liveryJS=ts.transpileModule(fs.readFileSync(new URL('../lib/flight/livery.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("from 'three'",`from '${import.meta.resolve('three')}'`);
const liveryURL='data:text/javascript;base64,'+Buffer.from(liveryJS).toString('base64');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("from './livery'",`from '${liveryURL}'`).replace("from './physics'",`from '${new URL('../lib/flight/physics.ts',import.meta.url).href}'`).replace("from 'three'",`from '${import.meta.resolve('three')}'`).replace("from 'three/addons/utils/BufferGeometryUtils.js'",`from '${import.meta.resolve('three/addons/utils/BufferGeometryUtils.js')}'`);
const {Boeing737}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const plane=new Boeing737();const state=initialState();plane.update(state,1/60);plane.group.updateMatrixWorld(true);let triangles=0,meshes=0;
plane.group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;meshes++;const p=o.geometry.attributes.position;for(let i=0;i<p.array.length;i++)assert.ok(Number.isFinite(p.array[i]),`${o.name}: non-finite vertex`);const index=o.geometry.index;if(index){for(const i of index.array)assert.ok(i<p.count);triangles+=index.count/3;}else triangles+=p.count/3;});
const bounds=new THREE.Box3().setFromObject(plane.group),size=bounds.getSize(new THREE.Vector3());assert.ok(Math.abs(size.z-39.47)<.1,'737 length');assert.ok(Math.abs(size.x-35.79)<.1,'737 wingspan');assert.ok(Math.abs(bounds.min.y+3.5)<.05,'wheels match ground datum');
const flap=plane.group.getObjectByName('trailing-edge flap').parent;state.flaps=3;state.controlPitch=.7;state.controlRoll=.5;state.controlYaw=-.3;for(let i=0;i<300;i++)plane.update(state,1/60);assert.ok(flap.rotation.x>.5,'flaps extend');assert.ok(plane.group.getObjectByName('elevator').parent.rotation.x<0,'elevator responds');assert.ok(plane.group.getObjectByName('rudder').parent.rotation.y>0,'rudder responds');
state.gearPosition=0;plane.update(state,1/60);assert.equal(plane.gear.visible,false);assert.equal(plane.noseGear.visible,false);assert.ok(Math.abs(plane.noseGear.rotation.x+Math.PI/2)<.001,'gear folds, does not squash');
plane.setCockpitView(true);assert.equal(plane.group.getObjectByName('smooth fuselage and radome').visible,false);plane.setCockpitView(false);assert.equal(plane.group.getObjectByName('smooth fuselage and radome').visible,true);
// Rays from outside must hit every windshield before they hit the white shell.
const shell=plane.group.getObjectByName('smooth fuselage and radome');
const cockpit=plane.group.getObjectByName('cockpit windshield assembly');
assert.ok(cockpit,'separate exterior cockpit assembly');
const panes=cockpit.children.filter(o=>/cockpit pane [123]$/.test(o.name));assert.equal(panes.length,6);
plane.group.updateMatrixWorld(true);
for(const pane of panes){const pos=pane.geometry.attributes.position,norm=pane.geometry.attributes.normal;
 for(const fraction of [.2,.5,.8]){const i=Math.floor(pos.count*fraction/3)*3,center=new THREE.Vector3(),normal=new THREE.Vector3();
  for(let j=0;j<3;j++){center.add(new THREE.Vector3().fromBufferAttribute(pos,i+j));normal.add(new THREE.Vector3().fromBufferAttribute(norm,i+j));}center.multiplyScalar(1/3);normal.normalize();const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2);assert.ok(b.sub(a).cross(c.sub(a)).dot(normal)>0,`${pane.name}: reversed glass face`);
  const ray=new THREE.Raycaster(center.clone().addScaledVector(normal,.5),normal.clone().negate(),0,3);const hits=ray.intersectObjects([shell,pane],false);
  assert.ok(hits.length&&hits[0].object===pane,`${pane.name}: windshield buried in fuselage`);
 }
 assert.ok(pane.material.color.getHex()<0x203040,'windshield stays dark');
}
plane.setCockpitView(true);assert.equal(cockpit.visible,false);plane.setCockpitView(false);assert.equal(cockpit.visible,true);
assert.equal(shell.material.name,'Boeing blue and white fuselage');
assert.equal(plane.group.getObjectByName('vertical stabilizer').material.name,'Boeing turquoise tail');
assert.equal(plane.group.getObjectByName('Boeing livery lettering').children.length,4);
assert.ok(triangles<110000,'keep aircraft geometry appropriate for Performance mode');
for(const object of [shell,plane.group.getObjectByName('vertical stabilizer')]){const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};object.material.onBeforeCompile(shader,null);assert.ok(shader.vertexShader.includes('vLiveryPosition=position'));assert.ok(shader.fragmentShader.includes('diffuseColor.rgb*=coat'));assert.equal(shader.uniforms.liveryBlue.value.getHexString(),'08235f');}
for(const label of plane.group.getObjectByName('Boeing livery lettering').children){const pos=label.geometry.attributes.position;const side=Math.sign(pos.getX(0)),tail=label.name==='737 tail marking';const ray=new THREE.Raycaster(new THREE.Vector3(side*5,tail?3.35:-.52,tail?14.7:-9.7),new THREE.Vector3(-side,0,0),0,10);const base=tail?plane.group.getObjectByName('vertical stabilizer'):shell;const hits=ray.intersectObjects([label,base],false);assert.ok(hits.length&&hits[0].object===label,`${label.name}: livery buried in shell`);}
assert.ok(plane.group.getObjectByName('APU exhaust rim'));
const apuOpening=plane.group.getObjectByName('APU dark outlet');assert.ok(apuOpening);plane.group.updateMatrixWorld(true);const apuRay=new THREE.Raycaster(new THREE.Vector3(0,.66,22),new THREE.Vector3(0,0,-1));assert.equal(apuRay.intersectObjects([shell,apuOpening],false)[0].object,apuOpening,'APU outlet visible ahead of tail cap');
const tailLabel=plane.group.getObjectByName('737 tail marking'),tailBounds=new THREE.Box3().setFromObject(tailLabel);assert.ok(tailBounds.max.z-tailBounds.min.z>3,'large tail numerals');
assert.equal(plane.group.getObjectByName('horizontal stabilizer').material.name,'Boeing tailplane finish');
console.log('Aircraft model checks passed:',{meshes,triangles,length:size.z,wingspan:size.x,gearDatum:bounds.min.y});
