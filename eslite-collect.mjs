import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {TARGET,products,classify} from './eslite-policy.mjs';
export async function collectEslite(id=TARGET) {
  if(!products[id]) throw Error('UNSUPPORTED_PRODUCT');
  await mkdir('evidence/eslite',{recursive:true});
  const url=`https://www.eslite.com/product/${id}`;
  const result={product_id:id,url,checked_at:null,name:'',observations:{online:'unknown'},samples:[],errors:[]};
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.setDefaultTimeout(10000);
  const active=async name=>{
    const buttons=page.getByRole('button',{name,exact:true});
    for(const b of await buttons.all()) if(await b.isVisible() && await b.isEnabled()) return true;
    return false;
  };
  try {
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    result.http_status=response?.status();
    if(!response?.ok()) throw Error(`PAGE_HTTP_${response?.status()}`);
    await page.getByRole('heading',{level:1}).first().waitFor({state:'visible',timeout:30000});
    let previous='unknown';
    // Require matching completed observations, separated by time, not loading placeholders.
    for(let attempt=0;attempt<8;attempt++) {
      await page.waitForTimeout(2000);
      const body=await page.locator('body').innerText();
      const sample={path:new URL(page.url()).pathname,name:await page.getByRole('heading',{level:1}).first().innerText(),
        cart:await active('加入購物車'),buy:await active('直接購買'),notify:await active('貨到通知'),
        blocked:/Sorry, you have been blocked|Verify you are human|驗證您是人類|Just a moment/i.test(body)};
      const status=classify(sample,id);
      result.samples.push({...sample,status,at:new Date().toISOString()});
      if(status!=='unknown' && status===previous) {result.observations.online=status;result.name=sample.name;break;}
      previous=status;
    }
    if(result.observations.online==='unknown') throw Error('INVENTORY_NOT_STABLE_OR_UNKNOWN');
  } catch(error) {
    result.observations.online='unknown';
    result.errors.push(error.message.slice(0,300));
  } finally {
    result.checked_at=new Date().toISOString();
    result.page_title=await page.title().catch(()=>'');
    await page.screenshot({path:`evidence/eslite/${id}.png`,fullPage:true}).catch(()=>{});
    await writeFile(`evidence/eslite/${id}.txt`,await page.locator('body').innerText().catch(()=>''));
    await browser.close();
  }
  await writeFile(`evidence/eslite/${id}.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  return result;
}
