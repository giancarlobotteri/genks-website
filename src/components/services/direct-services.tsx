import Link from "next/link";
import {Mic2,AudioLines,Disc3,ArrowUpRight} from "lucide-react";
import {getPublicDiscounts} from "@/lib/public-discounts-server";
import {discountPrice} from "@/lib/public-discounts";
import {serviceAmount} from "@/lib/service-rates";
export default async function DirectServices(){
 const offers=await getPublicDiscounts();const price=(base:number,target:string)=>serviceAmount(discountPrice(base,[target,...(target!=="recording"?["projects"]:[]),"services"],offers));
 const items=[{href:"/services/recording",title:"Registrazione",icon:Mic2,lines:[`${price(2000,"recording")} / ora`,"Scegli giorno e orario"],action:"Prenota in studio"},{href:"/services/project",title:"Mix e master",icon:AudioLines,lines:[`Mix da ${price(8999,"mix")}`,`Master ${price(3999,"master")}`,`Mix + master da ${price(11999,"mix_master")}`],action:"Scegli i tuoi brani"},{href:"/services/custom",title:"Beat su misura",icon:Disc3,lines:["Il tuo suono, da zero","Preventivo personalizzato"],action:"Parliamone"}];
 return <div className="portal-shell service-portal service-direct"><h1 className="sr-only">Scegli il servizio GENKS</h1><div className="service-choice-grid">{items.map((item,i)=><Link key={item.href} href={item.href} className="service-choice-card"><span className="service-choice-top"><span>0{i+1}</span><item.icon size={38} aria-hidden="true"/></span><h2>{item.title}</h2><div className="service-card-price">{item.lines.map((line,index)=>index===0?<strong key={line}>{line}</strong>:<span key={line}>{line}</span>)}</div><span className="service-choice-link">{item.action}<ArrowUpRight size={18} aria-hidden="true"/></span></Link>)}</div></div>;
}
