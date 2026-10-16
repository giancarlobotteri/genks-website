import { ImageResponse } from "next/og";
export const alt = "GENKS · Beat, studio e produzioni su misura";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",justifyContent:"center",padding:80,background:"linear-gradient(130deg,#030917,#153d76)",color:"white",fontFamily:"sans-serif"}}><div style={{position:"absolute",right:-140,top:-170,width:750,height:750,border:"2px solid #438de6",borderRadius:750,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:560,height:560,border:"2px solid #2868b9",borderRadius:560}} /></div><div style={{display:"flex",fontSize:128,fontWeight:700,letterSpacing:20}}>GENKS<span style={{color:"#70b8ff"}}>.</span></div><div style={{display:"flex",fontSize:33,marginTop:24}}>Beat. Studio. Produzioni su misura.</div><div style={{display:"flex",fontSize:23,marginTop:70,color:"#a5d5ff",letterSpacing:2}}>PRODBYGENKS.COM</div></div>,size);
}
