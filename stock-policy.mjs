export function mergeObservation(previous, observation) {
  const state=structuredClone(previous || {schema:1,known:{},notified:{}});
  if(state.schema!==1 || !state.known || !state.notified) throw Error('INVALID_SAVED_STATE');
  const alerts=[];
  for(const [key,status] of Object.entries(observation)) {
    if(!['in_stock','sold_out','unknown','not_offered'].includes(status)) throw Error('INVALID_STATUS');
    if(status==='unknown') continue;
    state.known[key]=status;
    if(status==='sold_out' || status==='not_offered') delete state.notified[key];
    if(status==='in_stock' && !state.notified[key]) alerts.push(key);
  }
  return {state,alerts};
}
