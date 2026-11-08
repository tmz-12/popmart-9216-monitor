import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TARGET,CONTROL} from './eslite-policy.mjs';
import {sendNotification,validateDestination} from './eslite-notify.mjs';
const result={product_id:TARGET,url:`https://www.eslite.com/product/${TARGET}`,name:'Owala FreeSip Tritan 740ml 柔光粉',observations:{online:'in_stock'},checked_at:'2026-11-08T10:00:00Z',errors:[]};
test('control, unknown, sold-out, errors and wrong URLs never send',async()=>{
  let calls=0;
  for(const patch of [{product_id:CONTROL},{observations:{online:'unknown'}},{observations:{online:'sold_out'}},{errors:['PAGE_HTTP_403']},{url:'https://www.eslite.com/'}]) {
    await assert.rejects(sendNotification({...result,...patch},{destination:'https://ntfy.sh/unit-test-only',request:async()=>{calls++;}}));
  }
  assert.equal(calls,0);
});
test('UTF-8 stock message, click target and acknowledgement match',async()=>{
  const id=await sendNotification(result,{destination:'https://ntfy.sh/unit-test-only',request:async(url,options)=>{
    assert.equal(options.method,'POST'); assert.equal(options.redirect,'manual');
    assert.match(options.body,/柔光粉 740ml/);assert.match(options.body,/台灣時間 UTC\+8/);
    assert.equal(options.headers.Click,result.url);assert.doesNotMatch(options.body,/POP MART/);
    return {ok:true,json:async()=>({event:'message',id:'mock-ack',topic:'unit-test-only',message:options.body})};
  }});
  assert.equal(id,'mock-ack');
});
test('failed or mismatched acknowledgement never records successful delivery',async()=>{
  for(const patch of [{ok:false},{event:'keepalive'},{id:''},{topic:'other'},{message:'wrong'}]) {
    await assert.rejects(sendNotification(result,{destination:'https://ntfy.sh/unit-test-only',request:async(url,options)=>({ok:patch.ok??true,json:async()=>({event:'message',id:'mock',topic:'unit-test-only',message:options.body,...patch})})}),/NTFY_NOT_ACKNOWLEDGED/);
  }
});
test('notification destination rejects insecure or unrelated hosts',()=>{
  for(const url of ['http://ntfy.sh/test','https://example.com/test','https://ntfy.sh/test?token=x']) assert.throws(()=>validateDestination(url));
});
