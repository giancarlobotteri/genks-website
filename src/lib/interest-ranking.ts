export type InterestBeat={id:string;slug:string;title:string;genre:string;mood:string;bpm:number;cover:string};
export function rankInterests(beats:InterestBeat[],events:string[]){
 const recent=events.map(id=>beats.find(b=>b.id===id)).filter((b):b is InterestBeat=>Boolean(b));
 return beats.map((beat,index)=>({beat,index,score:recent.reduce((score,seen,i)=>score+(beat.id===seen.id?5:0)+(beat.genre===seen.genre?3/(i+1):0)+(beat.mood===seen.mood?2/(i+1):0)+(Math.abs(beat.bpm-seen.bpm)<=10?1/(i+1):0),0)})).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,3).map(x=>x.beat);
}
