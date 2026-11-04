import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeObservation} from './stock-policy.mjs';
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
