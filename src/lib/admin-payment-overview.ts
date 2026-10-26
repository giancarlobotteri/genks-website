export type ReceiptMovement={amount_cents:number;refunded_cents:number;status:string;review_reason:string|null;disputed:boolean};
export function paymentOverview(total:number,movements:ReceiptMovement[]){
 const received=movements.filter(p=>p.status==='succeeded').reduce((n,p)=>n+p.amount_cents,0);
 const refunded=movements.reduce((n,p)=>n+p.refunded_cents,0);
 const review=refunded>0||movements.some(p=>Boolean(p.review_reason)||p.disputed);
 return {received,refunded,net:received-refunded,outstanding:Math.max(0,total-received),review};
}
