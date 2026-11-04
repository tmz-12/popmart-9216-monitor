// Read-only, manually triggered cloud validation. Never sends notifications or buys.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('evidence',{recursive:true});
const browser=await chromium.launch();
const results=[];
try {
  for(const product of [
    {id:'3317',name:'SKULLPANDA Lazy Panda Plush Doll Pendant',slug:'skullpanda-lazy-panda-plush-doll-pendant'},
    {id:'9216',name:'SKULLPANDA Plush Doll-Cage-Uncage',slug:'SKULLPANDA%20Plush%20Doll-Cage-Uncage'}
  ]) {
    const context=await browser.newContext();
    const page=await context.newPage();
    page.setDefaultTimeout(15000);
    const result={product_id:product.id,checked_at:new Date().toISOString(),online:'unknown',pickup:'unknown'};
    const ready=async(name)=>{
      const button=page.getByRole('button',{name,exact:true});
      return await button.count()===1 && await button.isVisible() && await button.isEnabled();
    };
    try {
      await page.goto(`https://www.popmart.com/us/products/${product.id}/${product.slug}`,{waitUntil:'domcontentloaded',timeout:45000});
      if(!new URL(page.url()).pathname.startsWith(`/us/products/${product.id}/`)) throw Error('REGION_OR_PRODUCT_REDIRECT');
      await page.getByRole('heading',{name:product.name,exact:true}).first().waitFor();
      const reject=page.getByRole('button',{name:'Reject All',exact:true});
      if(await reject.isVisible()) await reject.click();
      // Allow client-side inventory to hydrate; do not treat initial empty UI as no stock.
      await page.waitForTimeout(6000);
      if(await reject.isVisible()) await reject.click();
      const dialog=page.getByRole('dialog').filter({hasText:'Select Your Store for Pickup'});
      if(await dialog.count()===1 && await dialog.isVisible()) {
        const close=dialog.getByRole('button',{name:'Close',exact:true});
        if(await close.isVisible()) await close.click();
      }
      if(await ready('Deliver To Home')) {
        await page.getByRole('button',{name:'Deliver To Home',exact:true}).click();
        await page.waitForTimeout(4000);
        if(await ready('ADD TO CART') && await ready('BUY NOW')) {
          await page.waitForTimeout(2000);
          if(await ready('ADD TO CART') && await ready('BUY NOW')) result.online='in_stock';
        }
      }
      await page.screenshot({path:`evidence/${product.id}-purchase.png`});
      const switchStore=page.getByRole('button',{name:'Switch Store',exact:true});
      if(await switchStore.isVisible()) await switchStore.click();
      else if(await ready('Store Pickup')) await page.getByRole('button',{name:'Store Pickup',exact:true}).click();
      await dialog.waitFor({state:'visible'});
      const stockOnly=dialog.getByRole('switch',{name:'Only Show In-stock Stores',exact:true});
      await stockOnly.setChecked(true);
      await page.waitForTimeout(4000);
      result.pickupFilterChecked=await stockOnly.isChecked();
      result.pickupText=await dialog.innerText();
      // Human-reviewed evidence only: cloud store-row parsing is not yet qualified.
      result.pickup='captured_for_review';
      await page.screenshot({path:`evidence/${product.id}-pickup.png`});
      result.pageRead=true;
    } catch(error) {
      result.error=error.message?.slice(0,400);
      result.pageRead=false;
      process.exitCode=1;
      await page.screenshot({path:`evidence/${product.id}-failure.png`}).catch(()=>{});
    } finally {
      result.final_url=page.url();
      results.push(result);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile('evidence/result.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results.map(({product_id,online,pickup,pageRead})=>({product_id,online,pickup,pageRead}))));
}

