import * as THREE from 'three';

// The reference's colors are applied in model coordinates, so seams stay crisp
// without downloading large textures or changing the simulation's 737 variant.
export function boeingPaint(tail=false){
 const material=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.31,metalness:.06,clearcoat:.55,clearcoatRoughness:.23,side:THREE.DoubleSide});
 material.name=tail?'Boeing turquoise tail':'Boeing blue and white fuselage';
 material.onBeforeCompile=shader=>{
  shader.uniforms.liveryWhite={value:new THREE.Color('#eef2f4')};shader.uniforms.liveryBlue={value:new THREE.Color('#08235f')};shader.uniforms.liveryCyan={value:new THREE.Color('#35b9de')};
  shader.vertexShader='varying vec3 vLiveryPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLiveryPosition=position;');
  shader.fragmentShader='varying vec3 vLiveryPosition;uniform vec3 liveryWhite;uniform vec3 liveryBlue;uniform vec3 liveryCyan;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 lp=vLiveryPosition;
   ${tail?`vec2 cell=vec2(lp.z*4.,lp.y*3.8);cell.x+=mod(floor(cell.y),2.)*.5;vec2 tile=fract(cell)-.5;float hex=max(abs(tile.x)*.866+abs(tile.y)*.5,abs(tile.y));float pattern=smoothstep(.37,.42,hex);float tone=.45+.25*sin(floor(cell.x)*3.7+floor(cell.y)*1.3);vec3 coat=mix(liveryBlue,liveryCyan,tone+.2);coat=mix(coat,liveryBlue,pattern*.35);float swoosh=(1.-smoothstep(.1,.3,abs(lp.z-(16.4-.16*lp.y+sin(lp.y*.6)*.42))));coat=mix(coat,liveryCyan,swoosh*.65);`:
   `float boundary=.12+.16*exp(-pow((lp.z+15.)/5.,2.))+.3*smoothstep(4.,18.,lp.z);float edge=lp.y-boundary;float white=smoothstep(-.018,.018,edge);vec3 coat=mix(liveryBlue,liveryWhite,white);float cyanBand=(1.-smoothstep(.04,.11,abs(edge+.08)))*(1.-white);coat=mix(coat,liveryCyan,cyanBand*.9);float stripes=pow(.5+.5*sin((lp.y+.065*sin(lp.z*.3))*38.),14.);float sweep=smoothstep(-6.,4.,lp.z)*(1.-smoothstep(16.,19.,lp.z))*(1.-smoothstep(-.12,-.03,edge));coat=mix(coat,liveryCyan,stripes*sweep*.72);`}
   diffuseColor.rgb*=coat;
  `);
 };
 material.customProgramCacheKey=()=>tail?'boeing-tail-v1':'boeing-body-v1';return material;
}

export function aircraftLettering(kind:'boeing'|'737'){
 // Geometry can also be constructed in Node for the model checks.
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=kind==='boeing'?2048:1024;canvas.height=512;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#f2f7fa';ctx.textBaseline='middle';ctx.textAlign='center';
 if(kind==='boeing'){
  ctx.font='italic 900 310px Arial, sans-serif';ctx.fillText('BOEING',1250,268,1480);
  ctx.strokeStyle='#f2f7fa';ctx.lineWidth=12;ctx.beginPath();ctx.ellipse(258,260,116,184,.38,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.ellipse(258,260,190,53,-.58,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(210,60);ctx.lineTo(281,272);ctx.lineTo(455,379);ctx.stroke();
 }else{ctx.font='italic 900 390px Arial, sans-serif';ctx.shadowColor='#073d74';ctx.shadowOffsetX=10;ctx.shadowOffsetY=13;ctx.fillText('737',512,275,950);}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}
