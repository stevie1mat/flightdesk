import * as THREE from 'three';
import type {PilotState,Obstacle} from './pilot';
const ray=new THREE.Raycaster(),direction=new THREE.Vector3(),point=new THREE.Vector3();
// Shorten the boom before walls, seats, or the airframe, keeping the camera inside rooms.
export function pilotCamera(p:PilotState,camera:THREE.Camera,target:THREE.Vector3,meshes:THREE.Object3D[],obstacles:Obstacle[]){
 target.set(p.x,p.y-.18,p.z);camera.up.set(0,1,0);
 if(p.view==='First person'){camera.position.set(p.x,p.y,p.z);target.set(p.x+Math.sin(p.heading)*Math.cos(p.look),p.y+Math.sin(p.look),p.z-Math.cos(p.heading)*Math.cos(p.look));return;}
 const distance=p.zone==='Cabin'?1.7:4.6;direction.set(-Math.sin(p.heading)*Math.cos(p.look),.16-Math.sin(p.look),Math.cos(p.heading)*Math.cos(p.look)).normalize();let length=distance;
 ray.set(target,direction);ray.near=0;ray.far=distance;const hit=ray.intersectObjects(meshes,true)[0];if(hit)length=Math.max(.16,hit.distance-.16);
 if(p.zone==='Outside')for(let t=.2;t<length;t+=.15){point.copy(target).addScaledVector(direction,t);if(point.y<p.feetY+.25||obstacles.some(o=>Math.abs(point.x-o.x)<o.w/2+.18&&Math.abs(point.z-o.z)<o.d/2+.18)){length=Math.max(.16,t-.2);break;}}
 camera.position.copy(target).addScaledVector(direction,length);
}
