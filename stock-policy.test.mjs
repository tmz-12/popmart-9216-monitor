import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeObservation} from './stock-policy.mjs';
import {saveState,retryRead} from './state-store.mjs';
test('initial available state alerts, successful delivery deduplicates',()=>{
  const first=mergeObservation(null,{'pickup:A':'in_stock'});
  assert.deepEqual(first.alerts,['pickup:A']);
  first.state.notified['pickup:A']='message-id';
  assert.deepEqual(mergeObservation(first.state,{'pickup:A':'in_stock'}).alerts,[]);
});
test('unknown and missing stores preserve deduplication; confirmed sold-out resets it',()=>{
  const s={schema:1,known:{a:'in_stock'},notified:{a:'ack'}};
  assert.equal(mergeObservation(s,{a:'unknown'}).state.notified.a,'ack');
  assert.equal(mergeObservation(s,{}).state.notified.a,'ack');
  const out=mergeObservation(s,{a:'sold_out'});
  assert.deepEqual(mergeObservation(out.state,{a:'in_stock'}).alerts,['a']);
});
test('unacknowledged delivery remains eligible and stores are independent',()=>{
  const a=mergeObservation(null,{a:'in_stock',b:'sold_out'});
  assert.deepEqual(mergeObservation(a.state,{a:'in_stock',b:'in_stock'}).alerts,['a','b']);
  assert.throws(()=>mergeObservation(null,{a:'yes'}));
});

const temporary=()=>Object.assign(Error('STATE_HTTP_502'),{retryable:true,status:502});
const blob=(sha,state)=>({sha,content:Buffer.from(JSON.stringify(state,null,2)).toString('base64')});
const wanted={schema:1,known:{a:'in_stock'},notified:{a:'ack'}};
test('two failed writes recover with a fresh read before each retry',async()=>{
  const calls=[],waits=[]; let writes=0;
  const file=blob('old',{});
  const api=async(path,method='GET',body)=>{
    calls.push(method);
    if(method==='GET') return file;
    assert.equal(body.sha,'old');
    if(++writes<3) throw temporary();
    return {content:{sha:'new'}};
  };
  const result=await saveState({api,state:wanted,file,sleep:async ms=>waits.push(ms)});
  assert.equal(result.sha,'new');
  assert.deepEqual(calls,['GET','PUT','GET','PUT','GET','PUT']);
  assert.deepEqual(waits,[2000,5000]);
});
test('lost acknowledgement after commit is recovered without another write',async()=>{
  const file=blob('old',{}); let remote=file,writes=0;
  const api=async(path,method='GET')=>{
    if(method==='GET') return remote;
    writes++;remote=blob('committed',wanted);throw temporary();
  };
  const result=await saveState({api,state:wanted,file,sleep:async()=>{}});
  assert.equal(result.sha,'committed');assert.equal(writes,1);
});
test('failed reconciliation never causes a blind write',async()=>{
  const file=blob('old',{});let reads=0,writes=0;
  const api=async(path,method='GET')=>{
    if(method==='GET'){if(++reads>1)throw temporary();return file;}
    writes++;throw temporary();
  };
  await assert.rejects(saveState({api,state:wanted,file,sleep:async()=>{}}),/STATE_HTTP_502/);
  assert.equal(writes,1);
});
test('external state changes are not overwritten',async()=>{
  let writes=0;
  const api=async(path,method='GET')=>{if(method!=='GET')writes++;return blob('other',{notified:{a:'other-ack'}});};
  await assert.rejects(saveState({api,state:wanted,file:blob('old',{}),sleep:async()=>{}}),/STATE_CHANGED_EXTERNALLY/);
  assert.equal(writes,0);
});
test('final failed acknowledgement is reconciled; persistent failure stays failed',async()=>{
  for(const committed of [true,false]) {
    const file=blob('old',{});let remote=file,writes=0;
    const api=async(path,method='GET')=>{
      if(method==='GET')return remote;
      if(++writes===3 && committed)remote=blob('final',wanted);
      throw temporary();
    };
    const saving=saveState({api,state:wanted,file,sleep:async()=>{}});
    if(committed)assert.equal((await saving).sha,'final');
    else await assert.rejects(saving,/STATE_HTTP_502/);
    assert.equal(writes,3);
  }
});
test('read retry recovers transient errors, permission failures fail immediately',async()=>{
  let reads=0;
  assert.equal(await retryRead(async()=>{if(++reads<3)throw temporary();return 'ok';},{sleep:async()=>{}}),'ok');
  let attempts=0;
  await assert.rejects(retryRead(async()=>{attempts++;throw Error('STATE_HTTP_403');},{sleep:async()=>{}}),/403/);
  assert.equal(attempts,1);
});
