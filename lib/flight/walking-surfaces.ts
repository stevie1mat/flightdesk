import * as THREE from 'three';
// Registered from rendered pavement geometry, so visual and walking heights agree.
export class WalkingSurfaces{
 private surfaces:THREE.Box3[]=[];
 collect(root:THREE.Object3D){this.surfaces=[];root.updateMatrixWorld(true);root.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.walkingSurface){o.geometry.computeBoundingBox();this.surfaces.push(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));}});}
 height(x:number,z:number,terrain:number|null){let y=terrain;const soleReach=.28;for(const b of this.surfaces){if(x>=b.min.x-soleReach&&x<=b.max.x+soleReach&&z>=b.min.z-soleReach&&z<=b.max.z+soleReach)y=Math.max(y??-Infinity,b.max.y);}return y===null?null:y+.008;}
}
