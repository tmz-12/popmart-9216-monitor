import {collectEslite} from './eslite-collect.mjs';
import {TARGET,CONTROL} from './eslite-policy.mjs';
import {appendFile} from 'node:fs/promises';
let failed=false;
for(const id of [TARGET,CONTROL]) {
  const result=await collectEslite(id);
  if(result.errors.length || (id===CONTROL && result.observations.online!=='in_stock')) failed=true;
  if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,`\n${id}: ${result.observations.online}, errors=${result.errors.length}, observed=${result.checked_at}\n`);
}
if(failed) throw Error('ESLITE_CLOUD_VALIDATION_FAILED');
