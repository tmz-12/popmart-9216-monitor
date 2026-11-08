import {appendFile} from 'node:fs/promises';
import {collectEslite} from './eslite-collect.mjs';
import {TARGET} from './eslite-policy.mjs';
import {mergeObservation} from './stock-policy.mjs';
import {retryRead,saveState} from './state-store.mjs';
import {validateDestination,sendNotification} from './eslite-notify.mjs';
const result=await collectEslite(TARGET);
const summary=`\nEslite ${TARGET}\nObserved: ${result.checked_at}\nOnline: ${result.observations.online}\nRead errors: ${result.errors.length}\n`;
if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
if(result.errors.length || result.observations.online==='unknown') throw Error('ESLITE_SOURCE_READ_FAILED');
if(process.env.VALIDATE_ONLY!=='false') {console.log('Validation only: no state or push');process.exit(0);}
const repo=process.env.GITHUB_REPOSITORY;
if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo||'') || !process.env.GITHUB_TOKEN) throw Error('STATE_CONFIG_MISSING');
// Validate the configured destination without emitting a test notification.
validateDestination(process.env.NTFY_URL);
console.log('NTFY configuration present and valid; no connectivity message sent');
const base=`https://api.github.com/repos/${repo}`;
async function api(path,method='GET',body) {
  // Reuse the verified state-store implementation with a distinct file.
  path=path.replace('/contents/monitor-state.json','/contents/eslite-state.json');
  let response;
  try {response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});}
  catch {throw Object.assign(Error('STATE_NETWORK_ERROR'),{retryable:true});}
  if(response.status===404 && method==='GET') return null;
  if(!response.ok) throw Object.assign(Error(`STATE_HTTP_${response.status}`),{status:response.status,retryable:response.status>=500 || response.status===408});
  try {return await response.json();} catch {throw Object.assign(Error('STATE_RESPONSE_INVALID'),{retryable:true});}
}
if(!await retryRead(()=>api('/git/ref/heads/monitor-state'))) throw Error('STATE_BRANCH_MISSING');
let file=await retryRead(()=>api('/contents/monitor-state.json?ref=monitor-state'));
const previous=file?JSON.parse(Buffer.from(file.content,'base64').toString('utf8')):null;
if(previous && previous.product_id!==TARGET) throw Error('WRONG_SAVED_PRODUCT');
const {state,alerts}=mergeObservation(previous,result.observations);
state.product_id=TARGET;state.last_success_at=result.checked_at;
file=await saveState({api,state,file});
console.log('Eslite state saved');
if(alerts.length) {
  const ack=await sendNotification(result,{destination:process.env.NTFY_URL,token:process.env.NTFY_TOKEN});
  for(const key of alerts) state.notified[key]=ack;
  await saveState({api,state,file});
  console.log('Real target stock notification acknowledged');
} else console.log('No new stock: no notification');
