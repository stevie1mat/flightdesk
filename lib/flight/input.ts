import { idleInput, type Input } from './physics';
export class FlightInput {
 keys=new Set<string>(); connected=false;
 constructor(private action:(key:string)=>void){window.addEventListener('keydown',this.down);window.addEventListener('keyup',this.up);window.addEventListener('blur',this.clear);}
 down=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.closest('input,select,textarea,[role=dialog],[role=slider]'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code))e.preventDefault();this.keys.add(e.code);if(!e.repeat)this.action(e.code);};
 up=(e:KeyboardEvent)=>{this.keys.delete(e.code);};clear=()=>this.keys.clear();
 read():Input{const k=this.keys;const i=idleInput();i.pitch=Number(k.has('ArrowDown'))-Number(k.has('ArrowUp'));i.roll=Number(k.has('ArrowRight'))-Number(k.has('ArrowLeft'));i.yaw=Number(k.has('KeyE'))-Number(k.has('KeyQ'));i.throttle=Number(k.has('KeyW'))-Number(k.has('KeyS'));i.brake=k.has('Space');
 const pad=navigator.getGamepads?.();const p=pad&&Array.from(pad).find(Boolean);this.connected=!!p;
 if(p){const axis=(n:number)=>Math.abs(p.axes[n]||0)>.12?p.axes[n]:0;i.roll+=axis(0);i.pitch+=axis(1);i.yaw+=axis(2);i.throttle+=(p.buttons[7]?.value||0)-(p.buttons[6]?.value||0);i.brake ||= !!p.buttons[0]?.pressed;}
 return i;}
 dispose(){window.removeEventListener('keydown',this.down);window.removeEventListener('keyup',this.up);window.removeEventListener('blur',this.clear);}
}
