import {createHmac,timingSafeEqual} from 'node:crypto';
export function verifyResendSignature(body:string,headers:{id:string|null;timestamp:string|null;signature:string|null},secret:string|undefined,now=Date.now()){
 if(!secret?.startsWith('whsec_')||!headers.id||!headers.timestamp||!headers.signature||!/^[-\w]{3,200}$/.test(headers.id)||!/^\d{9,11}$/.test(headers.timestamp)||headers.signature.length>2048)return false;
 if(Math.abs(now/1000-Number(headers.timestamp))>300)return false;
 const key=Buffer.from(secret.slice(6),'base64');if(key.length<16)return false;
 const expected=createHmac('sha256',key).update(`${headers.id}.${headers.timestamp}.${body}`).digest();
 return headers.signature.split(' ').some(s=>{if(!s.startsWith('v1,'))return false;const provided=Buffer.from(s.slice(3),'base64');return provided.length===expected.length&&timingSafeEqual(provided,expected);});
}
