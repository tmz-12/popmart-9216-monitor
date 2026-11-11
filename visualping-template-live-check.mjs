import {webhookUrl, productUrl} from './eslite-visualping-webhook.mjs';
import {randomUUID} from 'node:crypto';
const destination = 'https://ntfy.sh/eslite_validation_' + randomUUID().replaceAll('-', '');
const endpoint = webhookUrl(destination, 9552410);
const base = {event:'change', job_id:9552410, url:productUrl, important:'true', removed_text:'貨到通知', added_text:'加入購物車;直接購買', datetime:new Date().toISOString()};
const cases = [
  ['positive', base, true],
  ['error', {...base,event:'error'}, false],
  ['unrelated', {...base,url:'https://example.com'}, false],
  ['ai_false', {...base,important:'false'}, false],
  ['price_only', {...base,added_text:'599'}, false],
  ['still_sold_out', {...base,removed_text:'價格'}, false],
  ['wrong_job', {...base,job_id:1}, false],
  ['missing_fields', {}, false],
  ['loading_placeholder', {...base,removed_text:''}, false],
];
for (const [name,payload,want] of cases) {
  const response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const body = await response.json();
  const pass = want
    ? response.ok && body.event === 'message' && body.click === productUrl && body.message.includes('柔光粉 740ml')
    : response.status === 400 && body.code === 40045;
  console.log(JSON.stringify({name,status:response.status,pass}));
  if (!pass) throw Error('Template validation failed: ' + JSON.stringify(body));
}
let rows = [];
for (let attempt = 0; attempt < 4; attempt++) {
  if (attempt) await new Promise(resolve => setTimeout(resolve, 2000));
  const response = await fetch(destination + '/json?poll=1&since=all');
  if (!response.ok) throw Error('Readback failed');
  rows = (await response.text()).trim().split('\n').filter(Boolean);
  if (rows.length) break;
}
console.log(JSON.stringify({published_count:rows.length,expected:1}));
if (rows.length !== 1) throw Error('Unexpected publication');
