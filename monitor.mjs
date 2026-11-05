import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {collect} from './collect.mjs';
import {mergeObservation} from './stock-policy.mjs';
import {retryRead,saveState} from './state-store.mjs';
await mkdir('evidence',{recursive:true});
const validate=process.env.VALIDATE_ONLY!=='false';
const id=validate ? (process.env.PRODUCT_ID || '9216') : '9216';
const result=await collect(id);
await writeFile('evidence/result.json',JSON.stringify(result,null,2));
const available=Object.entries(result.observations).filter(([,s])=>s==='in_stock').map(([k])=>k);
const summary=`## POP MART ${id}\n\nObserved: ${result.checked_at}\n\nMode: ${validate?'validation (no push)':'live'}\n\nRead errors: ${result.errors.length}\n\nOnline: ${result.observations.online || 'unknown'}\n\nStore rows: ${Object.keys(result.observations).filter(k=>k.startsWith('pickup:')).length}\n\nAvailable scopes: ${available.length}\n`;
if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
console.log(summary);
if(result.errors.length) {console.error('SOURCE_READ_FAILED');process.exit(1);}
if(validate) process.exit(0);

const repo=process.env.GITHUB_REPOSITORY;
if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '') || !process.env.GITHUB_TOKEN) throw Error('STATE_CONFIG_MISSING');
const base=`https://api.github.com/repos/${repo}`;
async function api(path,method='GET',body) {
  let response;
  try {
    response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
  } catch {throw Object.assign(Error('STATE_NETWORK_ERROR'),{retryable:true});}
  if(response.status===404 && method==='GET') return null;
  if(!response.ok) throw Object.assign(Error(`STATE_HTTP_${response.status}`),{status:response.status,retryable:response.status>=500 || response.status===408});
  try {return await response.json();} catch {throw Object.assign(Error('STATE_RESPONSE_INVALID'),{retryable:true});}
}
if(!await retryRead(()=>api('/git/ref/heads/monitor-state'))) {
  const main=await retryRead(()=>api('/git/ref/heads/main'));
  if(!main) throw Error('MAIN_BRANCH_MISSING');
  await api('/git/refs','POST',{ref:'refs/heads/monitor-state',sha:main.object.sha});
}
let file=await retryRead(()=>api('/contents/monitor-state.json?ref=monitor-state'));
const previous=file ? JSON.parse(Buffer.from(file.content,'base64').toString('utf8')) : null;
const {state,alerts}=mergeObservation(previous,result.observations);
async function save() {
  state.last_success_at=result.checked_at;
  file=await saveState({api,state,file});
}
// Verify persistence works before attempting any notification.
await save();
if(alerts.length) {
  let url;
  try {url=new URL(process.env.NTFY_URL);} catch {throw Error('NTFY_NOT_CONFIGURED');}
  if(url.protocol!=='https:' || url.host!=='ntfy.sh' || url.username || url.password || url.hash || url.search || !/^\/[A-Za-z0-9_-]{1,64}$/.test(url.pathname)) throw Error('INVALID_NTFY_URL');
  const text=`POP MART 9216 有货 / Stock available\n${result.name}\n${alerts.map(k=>k==='online'?'Online delivery / 线上配送':k.replace('pickup:','Store pickup / 门店自提: ')).join('\n')}\n${result.checked_at}\n${result.url}\n库存可能随时变化，请核对门店 / Availability may change.`;
  const response=await fetch(url,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'text/plain; charset=utf-8',Title:'POP MART 9216 - Stock available',Click:result.url,...(process.env.NTFY_TOKEN?{Authorization:`Bearer ${process.env.NTFY_TOKEN}`}:{})},body:text});
  const ack=await response.json().catch(()=>null);
  if(!response.ok || ack?.event!=='message' || !ack.id || ack.topic!==url.pathname.slice(1) || ack.message!==text) throw Error('NTFY_NOT_ACKNOWLEDGED');
  for(const key of alerts) state.notified[key]=ack.id;
  await save();
  if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,'\nReal stock notification acknowledged.\n');
}
