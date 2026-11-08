import {TARGET} from './eslite-policy.mjs';
export function validateDestination(destination) {
  const url=new URL(destination);
  if(url.protocol!=='https:' || url.host!=='ntfy.sh' || url.username || url.password || url.hash || url.search || !/^\/[A-Za-z0-9_-]{1,64}$/.test(url.pathname)) throw Error('INVALID_NTFY_URL');
  return url;
}
export function notification(result,destination) {
  if(result.product_id!==TARGET || result.observations.online!=='in_stock' || result.errors.length) throw Error('NOT_REAL_TARGET_STOCK');
  const url=validateDestination(destination);
  const productUrl=`https://www.eslite.com/product/${TARGET}`;
  if(result.url!==productUrl) throw Error('WRONG_TARGET_URL');
  const time=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'medium',hour12:false}).format(new Date(result.checked_at));
  return {url,productUrl,text:`誠品補貨｜Owala 柔光粉 740ml\n${result.name}\n誠品線上目前顯示可購買\n檢查時間：${time}（台灣時間 UTC+8）\n${productUrl}\n庫存可能隨時變動，請以結帳頁為準。`};
}
export async function sendNotification(result,{destination,token,request=fetch}) {
  const {url,productUrl,text}=notification(result,destination);
  const response=await request(url,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),
    headers:{'Content-Type':'text/plain; charset=utf-8',Title:'Eslite - Owala FreeSip Tritan 740ml Pink in stock',Click:productUrl,...(token?{Authorization:`Bearer ${token}`}:{})},body:text});
  const ack=await response.json().catch(()=>null);
  if(!response.ok || ack?.event!=='message' || !ack.id || ack.topic!==url.pathname.slice(1) || ack.message!==text) throw Error('NTFY_NOT_ACKNOWLEDGED');
  return ack.id;
}
