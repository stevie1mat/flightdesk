import type {FlightState} from './physics';

// A decoded local file uses the AudioContext unlocked by Start flight.
export class TakeoffMusic {
 private buffer:AudioBuffer|null=null;
 private source:AudioBufferSourceNode|null=null;
 private gain:GainNode|null=null;
 private offset=0;
 private startedAt=0;
 private airborne=false;
 private finished=false;
 private generation=0;
 volume=.3;
 async load(file:File,context:AudioContext){
  const generation=++this.generation;
  const buffer=await context.decodeAudioData(await file.arrayBuffer());
  if(generation!==this.generation)return;
  this.stop();this.buffer=buffer;this.finished=false;this.offset=0;
 }
 clear(){this.generation++;this.stop();this.buffer=null;this.offset=0;this.finished=false;}
 reset(){this.stop();this.offset=0;this.airborne=false;this.finished=false;}
 private stop(){if(this.source){this.source.onended=null;this.source.stop();this.source.disconnect();this.source=null;}}
 update(s:FlightState,muted:boolean,context:AudioContext){
  if(s.phase==='Preflight'){this.reset();return;}
  if(s.running&&!s.paused&&!s.onGround&&!s.touchdown)this.airborne=true;
  const active=this.airborne&&s.running&&!s.paused&&s.phase!=='Complete'&&s.phase!=='Crashed';
  if(!active){if(this.source){this.offset+=Math.max(0,context.currentTime-this.startedAt);this.stop();}return;}
  if(!this.buffer||this.finished)return;
  if(!this.gain){this.gain=context.createGain();this.gain.gain.value=0;this.gain.connect(context.destination);}
  if(!this.source){
   if(this.offset>=this.buffer.duration){this.finished=true;return;}
   const source=context.createBufferSource();source.buffer=this.buffer;source.connect(this.gain);
   source.onended=()=>{if(this.source===source){this.finished=true;this.source=null;source.disconnect();}};
   this.source=source;this.startedAt=context.currentTime;this.gain.gain.setValueAtTime(0,context.currentTime);source.start(0,this.offset);
  }
  this.gain.gain.setTargetAtTime(muted?0:this.volume*(s.warning&&s.warning!=='ROTATE'?.25:1),context.currentTime,muted?.04:.7);
 }
 dispose(){this.clear();this.gain?.disconnect();this.gain=null;}
}
