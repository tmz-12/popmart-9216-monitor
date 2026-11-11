export const productUrl = 'https://www.eslite.com/product/10052271402683055271007';
// Reject errors and unrelated changes even if the provider's AI filter misfires.
export function webhookUrl(destination, jobId, test = false) {
  if (!Number.isSafeInteger(jobId) || jobId < 1) throw Error('Invalid job ID');
  const url = new URL(destination);
  if (url.origin !== 'https://ntfy.sh' || !/^\/[A-Za-z0-9_-]+$/.test(url.pathname)) throw Error('Invalid destination');
  const message = test
    ? '【連線測試，非補貨】誠品 Owala 柔光粉 740ml：Visualping 雲端通知已送達。'
    : `{{if not (and (eq .event "change") (eq .job_id ${jobId}.0) (eq .url "${productUrl}") (eq (toString .important) "true") (contains "貨到通知" (default "" .removed_text)) (contains "加入購物車" (default "" .added_text)) (contains "直接購買" (default "" .added_text)))}}{{fail "Not a verified target restock transition"}}{{end}}誠品補貨｜Owala FreeSip Tritan 柔光粉 740ml\n雲端偵測到購買按鈕出現、貨到通知消失。\n檢查時間：{{.datetime}}\n${productUrl}`;
  url.searchParams.set('tpl', 'yes');
  url.searchParams.set('title', test ? 'Eslite monitor TEST' : 'Eslite Owala restock');
  url.searchParams.set('message', message);
  url.searchParams.set('click', productUrl);
  return url.toString();
}
