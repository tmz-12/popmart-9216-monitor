import {chromium} from 'playwright';
export const products={
  '9216':{name:'SKULLPANDA Plush Doll-Cage-Uncage',slug:'SKULLPANDA%20Plush%20Doll-Cage-Uncage'},
  '3317':{name:'SKULLPANDA Lazy Panda Plush Doll Pendant',slug:'skullpanda-lazy-panda-plush-doll-pendant'}
};
export async function collect(id='9216') {
  if(!products[id]) throw Error('UNSUPPORTED_PRODUCT');
  const product=products[id];
  const url=`https://www.popmart.com/us/products/${id}/${product.slug}`;
  const browser=await chromium.launch();
  const page=await browser.newPage();
  page.setDefaultTimeout(15000);
  const output={product_id:id,name:product.name,url,checked_at:new Date().toISOString(),observations:{},stores:[],errors:[]};
  const ready=async(name)=>{
    const b=page.getByRole('button',{name,exact:true});
    return await b.count()===1 && await b.isVisible() && await b.isEnabled();
  };
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    if(!new URL(page.url()).pathname.startsWith(`/us/products/${id}/`)) throw Error('WRONG_PRODUCT_OR_REGION');
    await page.getByRole('heading',{name:product.name,exact:true}).first().waitFor();
    await page.waitForTimeout(6000);
    const reject=page.getByRole('button',{name:'Reject All',exact:true});
    if(await reject.isVisible()) await reject.click();
    const dialog=page.getByRole('dialog').filter({hasText:'Select Your Store for Pickup'});
    if(await dialog.isVisible()) await dialog.getByRole('button',{name:'Close',exact:true}).click();
    output.observations.online='unknown';
    if(await ready('Deliver To Home')) {
      await page.getByRole('button',{name:'Deliver To Home',exact:true}).click();
      await page.waitForTimeout(4000);
      const online1=await ready('ADD TO CART') && await ready('BUY NOW');
      await page.waitForTimeout(2000);
      if(online1 && await ready('ADD TO CART') && await ready('BUY NOW')) output.observations.online='in_stock';
      else if(await ready('NOTIFY ME') || await ready('NOTIFY ME WHEN AVAILABLE')) output.observations.online='sold_out';
    } else if(await ready('Store Pickup')) output.observations.online='not_offered';
    await page.screenshot({path:`evidence/${id}-online.png`});
    // The page can reopen pickup automatically after its async hydration.
    if(!await dialog.isVisible()) {
      if(await ready('Switch Store')) await page.getByRole('button',{name:'Switch Store',exact:true}).click();
      else if(await ready('Store Pickup')) await page.getByRole('button',{name:'Store Pickup',exact:true}).click();
    }
    await dialog.waitFor({state:'visible'});
    const filter=dialog.getByRole('switch',{name:'Only Show In-stock Stores',exact:true});
    await filter.setChecked(false);
    await page.waitForTimeout(3000);
    const rows=async()=>dialog.getByRole('button').evaluateAll(es=>es.map(e=>({text:e.innerText.trim(),disabled:e.disabled || e.getAttribute('aria-disabled')==='true'})).filter(e=>e.text.split('\n').filter(Boolean).length>=2));
    const allRows=await rows();
    if(!allRows.length) throw Error('NO_STORE_ROWS');
    const key=text=>'pickup:'+text.split('\n').map(x=>x.trim()).filter(x=>x && !/^(Not Sold|Out of stock|In stock)$/i.test(x)).join(' | ');
    for(const row of allRows) output.observations[key(row.text)]=/\b(Not Sold|Out of stock)\b/i.test(row.text)?'sold_out':'unknown';
    await filter.setChecked(true);
    await page.waitForTimeout(3000);
    if(!await filter.isChecked()) throw Error('FILTER_NOT_CHECKED');
    const first=await rows();
    await page.waitForTimeout(2000);
    const second=await rows();
    const stable=JSON.stringify(first)===JSON.stringify(second);
    if(!stable) throw Error('UNSTABLE_STORE_LIST');
    const text=await dialog.innerText();
    if(!second.length && !text.includes('This item is currently unavailable for Store Pickup')) throw Error('EMPTY_UNKNOWN_STORE_LIST');
    // The checked, stable availability filter is authoritative even when badges
    // are CSS-generated and absent from innerText. Absent listed stores are unavailable.
    for(const row of allRows) output.observations[key(row.text)]='sold_out';
    for(const row of second) {
      if(row.disabled || /\b(Not Sold|Out of stock)\b/i.test(row.text)) continue;
      const k=key(row.text);
      if(!(k in output.observations)) throw Error('STORE_LIST_MISMATCH');
      output.observations[k]='in_stock';
      output.stores.push(row.text);
    }
    output.pickupText=text;
    await page.screenshot({path:`evidence/${id}-pickup.png`});
  } catch(error) {
    // A partial/ambiguous run never produces an actionable stock event.
    for(const k of Object.keys(output.observations)) output.observations[k]='unknown';
    output.errors.push(error.message.slice(0,500));
    await page.screenshot({path:`evidence/${id}-error.png`}).catch(()=>{});
  } finally {await browser.close();}
  return output;
}
