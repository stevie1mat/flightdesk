import fs from 'node:fs';
import path from 'node:path';
import {MeshoptSimplifier} from 'meshoptimizer';
await MeshoptSimplifier.ready;
const root=path.resolve(process.argv[2]||'public/assets/hd/tree');
const gltf=JSON.parse(fs.readFileSync(path.join(root,'tree.gltf'),'utf8'));
const source=fs.readFileSync(path.join(root,gltf.buffers[0].uri));
const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};const types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array};
function read(id){const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],T=types[a.componentType],w=widths[a.type];const result=new T(a.count*w);const stride=v.byteStride||w*T.BYTES_PER_ELEMENT;for(let i=0;i<a.count;i++){const start=(v.byteOffset||0)+(a.byteOffset||0)+i*stride;const b=source.subarray(start,start+w*T.BYTES_PER_ELEMENT);result.set(new T(b.buffer,b.byteOffset,w),i*w);}return result;}
const chunks=[],views=[],accessors=[];let offset=0;
function add(data,type,componentType){const padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}const view=views.length;views.push({buffer:0,byteOffset:offset,byteLength:data.byteLength});chunks.push(Buffer.from(data.buffer,data.byteOffset,data.byteLength));offset+=data.byteLength;const a={bufferView:view,componentType,count:data.length/widths[type],type};if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<data.length;i++){const k=i%3;a.min[k]=Math.min(a.min[k],data[i]);a.max[k]=Math.max(a.max[k],data[i]);}}accessors.push(a);return accessors.length-1;}
for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){const positions=read(primitive.attributes.POSITION),normals=read(primitive.attributes.NORMAL),uv=read(primitive.attributes.TEXCOORD_0),indices=new Uint32Array(read(primitive.indices));const attributes=new Float32Array(positions.length/3*5);for(let i=0;i<positions.length/3;i++){attributes.set(normals.subarray(i*3,i*3+3),i*5);attributes.set(uv.subarray(i*2,i*2+2),i*5+3);}
 const target=Math.min(indices.length,primitive.material===0?9000:45000);const[simplified,error]=MeshoptSimplifier.simplifyWithAttributes(indices,positions,3,attributes,5,[.01,.01,.01,.05,.05],null,target,.1,['Permissive','Prune']);const[remap,count]=MeshoptSimplifier.compactMesh(simplified);
 function compact(a,w){const b=new Float32Array(count*w);for(let i=0;i<remap.length;i++)if(remap[i]!==0xffffffff)b.set(a.subarray(i*w,i*w+w),remap[i]*w);return b;}
 primitive.attributes={POSITION:add(compact(positions,3),'VEC3',5126),NORMAL:add(compact(normals,3),'VEC3',5126),TEXCOORD_0:add(compact(uv,2),'VEC2',5126)};primitive.indices=add(simplified,'SCALAR',5125);console.log(`${indices.length/3} → ${simplified.length/3} triangles; error ${error.toFixed(3)}`);
}
gltf.bufferViews=views;gltf.accessors=accessors;gltf.buffers=[{uri:'tree-optimized.bin',byteLength:offset}];fs.writeFileSync(path.join(root,'tree-optimized.bin'),Buffer.concat(chunks));fs.writeFileSync(path.join(root,'tree-optimized.gltf'),JSON.stringify(gltf));console.log('Optimized geometry:',(offset/1024/1024).toFixed(2),'MB');
