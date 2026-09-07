import * as THREE from 'three';
const ROOT='/assets/hd/';
export function loadSurface(kind:'grass'|'asphalt',manager:THREE.LoadingManager){const loader=new THREE.TextureLoader(manager);const setup=(file:string,color=false)=>{const t=loader.load(ROOT+file);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=16;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;return t;};
 const mat=new THREE.MeshStandardMaterial({color:kind==='grass'?0xb7c891:0xd4d7d5,map:setup(`${kind}-color-4k.jpg`,true),normalMap:setup(`${kind}-normal-2k.jpg`),roughnessMap:setup(`${kind}-roughness-2k.jpg`),roughness:1,normalScale:new THREE.Vector2(kind==='grass'?.65:.35,kind==='grass'?.65:.35),side:THREE.DoubleSide});
 const tile=kind==='grass'?6:18;
 mat.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vSurfaceWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvSurfaceWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='varying vec3 vSurfaceWorld;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
 vec2 surfaceUV=vSurfaceWorld.xz/${tile.toFixed(1)};
 vec4 sampledDiffuseColor=texture2D(map,surfaceUV);
 ${kind==='grass'?`vec4 macroColor=texture2D(map,surfaceUV*.071+vec2(.32,.71));float variation=.90+.12*sin(vSurfaceWorld.x*.019+sin(vSurfaceWorld.z*.008));sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,macroColor.rgb,.25)*variation;`:''}
 diffuseColor*=sampledDiffuseColor;
 #endif`);
 // Match derivative-based normal mapping to the physical surface scale.
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',THREE.ShaderChunk.normal_fragment_begin.replaceAll('vNormalMapUv',`(vSurfaceWorld.xz/${tile.toFixed(1)})`));
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps.replaceAll('vNormalMapUv',`(vSurfaceWorld.xz/${tile.toFixed(1)})`));
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',THREE.ShaderChunk.roughnessmap_fragment.replaceAll('vRoughnessMapUv',`(vSurfaceWorld.xz/${tile.toFixed(1)})`));
 };mat.customProgramCacheKey=()=>`hd-surface-${kind}-v1`;return mat;}
