import * as THREE from 'three';

// The reference's colors are applied in model coordinates, so seams stay crisp
// without downloading large textures or changing the simulation's 737 variant.
export function boeingPaint(tail:boolean|'stabilizer'=false,offset=new THREE.Vector3()){
 const material=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.31,metalness:.06,clearcoat:.55,clearcoatRoughness:.23,side:THREE.DoubleSide});
 material.name=tail==='stabilizer'?'Boeing tailplane finish':tail?'Boeing turquoise tail':'Boeing blue and white fuselage';
 material.onBeforeCompile=shader=>{
  shader.uniforms.liveryOffset={value:offset};shader.uniforms.tailBright={value:new THREE.Color('#08b6e4')};shader.uniforms.tailDeep={value:new THREE.Color('#007cb9')};shader.uniforms.tailRibbon={value:new THREE.Color('#b6e5f1')};
  shader.uniforms.liveryWhite={value:new THREE.Color('#eef2f4')};shader.uniforms.liveryBlue={value:new THREE.Color('#08235f')};shader.uniforms.liveryCyan={value:new THREE.Color('#35b9de')};
  shader.vertexShader='varying vec3 vLiveryPosition;uniform vec3 liveryOffset;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLiveryPosition=position+liveryOffset;');
  shader.fragmentShader=`varying vec3 vLiveryPosition;uniform vec3 liveryWhite;uniform vec3 liveryBlue;uniform vec3 liveryCyan;uniform vec3 tailBright;uniform vec3 tailDeep;uniform vec3 tailRibbon;
   vec3 tailMosaic(vec2 p){vec2 cell=p*3.5;cell.x+=mod(floor(cell.y),2.)*.5;vec2 f=fract(cell)-.5;float hex=max(abs(f.x)*.866+abs(f.y)*.5,abs(f.y));float inside=1.-smoothstep(.28,.40,hex);float seed=fract(sin(dot(floor(cell),vec2(37.1,91.7)))*43758.5);float spot=inside*smoothstep(.35,.7,seed);return mix(tailBright,tailDeep,spot*.78);}
   `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 lp=vLiveryPosition;
   ${tail==='stabilizer'?`float center=1.+clamp((abs(lp.x)-.7)/6.4,0.,1.)*.5;float upper=smoothstep(center-.008,center+.008,lp.y);vec3 underside=mix(liveryBlue,tailMosaic(lp.xz),.38);vec3 coat=mix(underside,liveryWhite*.88,upper);`:
   tail?`vec3 coat=tailMosaic(lp.zy);float leading=9.3+1.95*clamp((lp.y-1.2)/1.2,0.,1.)+1.8*clamp((lp.y-2.4)/1.9,0.,1.)+2.35*clamp((lp.y-4.3)/3.6,0.,1.)+.4*clamp((lp.y-7.9)/.75,0.,1.);float finU=(lp.z-leading)/max(.8,17.55-leading);float q=clamp((lp.y-2.1)/4.65,0.,1.);float diagonal=(1.-smoothstep(.095,.15,abs(finU-(.17+.68*q))))*smoothstep(1.9,2.2,lp.y)*(1.-smoothstep(6.85,7.05,lp.y));float bar=smoothstep(6.65,6.8,lp.y)*(1.-smoothstep(7.25,7.4,lp.y));coat=mix(coat,tailRibbon,max(diagonal,bar)*.95);`:
   `float boundary=.12+.16*exp(-pow((lp.z+15.)/5.,2.))+.3*smoothstep(4.,18.,lp.z);float edge=lp.y-boundary;float white=smoothstep(-.018,.018,edge);vec3 coat=mix(liveryBlue,liveryWhite,white);float cyanBand=(1.-smoothstep(.04,.11,abs(edge+.08)))*(1.-white);coat=mix(coat,liveryCyan,cyanBand*.9);float stripes=pow(.5+.5*sin((lp.y+.065*sin(lp.z*.3))*38.),14.);float sweep=smoothstep(-6.,4.,lp.z)*(1.-smoothstep(17.3,19.,lp.z))*(1.-smoothstep(-.12,-.03,edge));coat=mix(coat,liveryCyan,stripes*sweep*.72);float root=smoothstep(9.,13.5,lp.z)*(1.-smoothstep(16.8,18.5,lp.z))*smoothstep(.35,.8,lp.y);coat=mix(coat,tailMosaic(lp.zy),root);coat=mix(coat,liveryBlue,smoothstep(18.1,19.25,lp.z));`}

   diffuseColor.rgb*=coat;
  `);
 };
 material.customProgramCacheKey=()=>`boeing-${tail==='stabilizer'?'stabilizer':tail?'tail':'body'}-v2`;return material;
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
