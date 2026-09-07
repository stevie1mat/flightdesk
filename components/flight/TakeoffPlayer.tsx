'use client';
import {useEffect,useRef,useState} from 'react';

type Player={playVideo:()=>void;pauseVideo:()=>void;mute:()=>void;unMute:()=>void;setVolume:(v:number)=>void;destroy:()=>void};
type API={Player:new(element:HTMLElement,options:object)=>Player};
type YouTubeWindow=Window&{YT?:API;onYouTubeIframeAPIReady?:()=>void};
let apiPromise:Promise<API>|null=null;
function loadAPI(){
 const win=window as YouTubeWindow;
 if(win.YT?.Player)return Promise.resolve(win.YT);
 if(!apiPromise)apiPromise=new Promise<API>((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
  const previous=win.onYouTubeIframeAPIReady;
  const timer=setTimeout(()=>{apiPromise=null;reject(new Error('YouTube did not respond'));},15000);
  win.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);previous?.();if(win.YT)resolve(win.YT);};
  script.onerror=()=>{clearTimeout(timer);apiPromise=null;script.remove();reject(new Error('YouTube is unavailable'));};
  document.head.appendChild(script);
 });
 return apiPromise;
}
export function TakeoffPlayer({paused,muted,volume,onClose}:{paused:boolean;muted:boolean;volume:number;onClose:()=>void}){
 const host=useRef<HTMLDivElement>(null),player=useRef<Player|null>(null),latest=useRef({paused,muted,volume});
 latest.current={paused,muted,volume};
 const [ready,setReady]=useState(false),[message,setMessage]=useState('Loading takeoff soundtrack…');
 useEffect(()=>{
  let cancelled=false;let instance:Player|null=null;
  void loadAPI().then(api=>{
   if(cancelled||!host.current)return;
   const mount=document.createElement('div');host.current.appendChild(mount);
   instance=new api.Player(mount,{width:320,height:200,videoId:'kyLuzKbgXAs',playerVars:{playsinline:1,controls:1,origin:window.location.origin},events:{
    onReady:(event:{target:Player})=>{if(cancelled)return;player.current=event.target;setReady(true);const p=latest.current;event.target.setVolume(p.volume);if(p.muted)event.target.mute();if(!p.paused)event.target.playVideo();setMessage('If sound does not start, press Play.');},
    onAutoplayBlocked:()=>{if(!cancelled)setMessage('Press Play to start the song.');},
    onStateChange:(event:{data:number})=>{if(!cancelled&&event.data===1)setMessage('Takeoff soundtrack');},
    onError:()=>{if(!cancelled)setMessage('This video cannot play here. Use a local song in Settings.');}
   }});
  }).catch(()=>{if(!cancelled)setMessage('YouTube is unavailable. Use a local song in Settings.');});
  return()=>{cancelled=true;player.current=null;instance?.destroy();};
 },[]);
 useEffect(()=>{const p=player.current;if(!p||!ready)return;if(paused)p.pauseVideo();else p.playVideo();},[paused,ready]);
 useEffect(()=>{const p=player.current;if(!p||!ready)return;p.setVolume(volume);if(muted)p.mute();else p.unMute();},[muted,volume,ready]);
 return <aside className="takeoff-player panel"><div className="panel-heading"><span>TAKEOFF MUSIC</span><button className="icon-button" aria-label="Stop takeoff music" onClick={onClose}>×</button></div><div ref={host}/><p role="status">{message}</p></aside>;
}
