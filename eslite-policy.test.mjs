import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classify,TARGET,CONTROL} from './eslite-policy.mjs';
import {mergeObservation} from './stock-policy.mjs';
const sample={path:`/product/${TARGET}`,name:'Owala Freesip Tritan 740ml 柔光粉',cart:false,buy:false,notify:true,blocked:false};
test('target unavailable and positive control available',()=>{
  assert.equal(classify(sample,TARGET),'sold_out');
  assert.equal(classify({...sample,path:`/product/${CONTROL}`,name:'BlenderBottle 酷洛米 740ml',cart:true,buy:true,notify:false},CONTROL),'in_stock');
});
test('loading, wrong variant, contradictory and blocked pages remain unknown',()=>{
  for(const patch of [{name:''},{name:'Owala Tritan 740ml 冰河白'},{path:`/product/${CONTROL}`},{notify:false},{cart:true},{cart:true,buy:true},{blocked:true}]) assert.equal(classify({...sample,...patch},TARGET),'unknown');
});
test('restock deduplication survives unknown readings and rearms only after sellout',()=>{
  let {state,alerts}=mergeObservation(null,{online:'in_stock'});
  assert.deepEqual(alerts,['online']); state.notified.online='ack';
  state=mergeObservation(state,{online:'unknown'}).state;
  assert.deepEqual(mergeObservation(state,{online:'in_stock'}).alerts,[]);
  state=mergeObservation(state,{online:'sold_out'}).state;
  assert.deepEqual(mergeObservation(state,{online:'in_stock'}).alerts,['online']);
});
