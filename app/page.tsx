'use client';
import dynamic from 'next/dynamic';
const Simulator=dynamic(()=>import('@/components/flight/Simulator'),{ssr:false,loading:()=> <div className="loading-flight"><span>FLIGHTDECK</span><p>Preparing your aircraft…</p></div>});
export default function Home(){return <Simulator/>;}
