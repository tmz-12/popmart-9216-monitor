# POP MART 9216 US stock monitor

> 2026-11-05 reliability audit: the five-minute cron is configured, but the first overnight window produced only three scheduled runs, at 20:49 UTC Nov 4, 01:06 and 07:51 UTC Nov 5; one failed. This is **not verified reliable five-minute monitoring**. The latest successful observation at 07:52 UTC found 101 unavailable stores. See Actions for actual times. A separate reliable scheduler is still needed if the five-minute requirement is strict.

> 中文：已接通真实库存与 ntfy，但昨晚只自动触发三次，不能称为已实现可靠的五分钟监控。请以 Actions 实际运行时间为准。11月5日的修正等待门店弹窗完全关闭，并等待门店列表稳定，避免动画期间误读为空列表。

Reads the real public US product page and its store pickup selector. No mock inventory, private API replay, sign-in, purchase automation or access-control bypass. Product 3317 is an optional validation reference only; live mode always uses 9216.

## 使用方法 / How to use

- 手机继续订阅原来的 ntfy 主题并允许通知。发现 9216 线上配送或任意页面列出的美国门店有货时，会发送商品、门店地址、时间和商品链接。持续有货不重复提醒；确认缺货后再次有货才重发。
- 运行在 GitHub 的云端电脑上，你自己的电脑可以关机。查看本仓库 **Actions → POP MART 9216 stock monitor**；打开最新运行查看实际检查时间、线上状态及门店数量。绿色表示该次检查成功，不代表商品有货。
- 检查计划为每小时第 2、7、12……57 分钟。GitHub 可能延迟或漏掉计划任务，不能保证整整五分钟或即时到货通知。短暂补货可能错过。
- 手动检查：Actions → 此工作流 → Run workflow。默认勾选“Read real pages without sending notifications”仅验证；取消勾选才运行正式 9216 检查和通知。
- 暂停：工作流页面右上角菜单 → Disable workflow。恢复使用 Enable workflow。
- 如果最新运行变红或检查时间明显过旧，打开失败步骤查看原因。读取失败会失败退出，保留之前的通知状态，不会把错误当成缺货。此版本的故障提示在 GitHub，不发送伪装成到货的 ntfy 消息。

Keep the ntfy phone subscription and notification permission enabled. Only newly observed stock is pushed. Check Actions for the last successful observation; a green run means the check succeeded, not that stock exists. Your PC can be off. The five-minute schedule is best effort, not an SLA.

## Verification evidence (2026-11-04 UTC)

- [9216 cloud validation](https://github.com/tmz-12/popmart-9216-monitor/actions/runs/41843454711): 101 store rows; zero available; online delivery not offered.
- [3317 real positive reference](https://github.com/tmz-12/popmart-9216-monitor/actions/runs/41843720903): online in stock, 39 available pickup stores, 101 total rows. No notification sent for this reference.
- [Initial live run](https://github.com/tmz-12/popmart-9216-monitor/actions/runs/41844044300): successful collection and durable state write.
- Three state-policy tests cover first stock, deduplication, confirmed sell-out/re-stock, unknown readings and retry after an unacknowledged delivery.
- The user previously confirmed receiving an ntfy phone connectivity notification. A real 9216 restock has not yet been observed, so a real cloud-triggered 9216 restock delivery has not been demonstrated. No further test push is sent by this monitor.

The early readability pilot encountered a cookie/pickup dialog selector ambiguity and a slow optional-font installation. The production collector scopes the pickup dialog and uses the runner's installed system libraries. Store status is taken from the checked, stable in-stock filter; CSS badges may be absent from text.

## State and failure behavior

State saves now make up to three write attempts, waiting 2 then 5 seconds. Before each write, the current remote bytes and blob SHA are checked. If a failed response actually committed the intended state, the next read acknowledges it without writing again. Different externally updated state is never overwritten. After the final ambiguous write, one final read checks whether it committed. Exhausted retries still fail visibly in Actions; no failure or recovery notification is sent to ntfy. Transient initial reads also retry. This improves recovery from GitHub 500/502 and network failures but does not fix missed scheduler triggers or guarantee exactly-once delivery.

The `monitor-state` branch stores `monitor-state.json`, including per-store known status, successful notification IDs and `last_success_at`. No credentials are stored there. A failed or ambiguous read does not reset deduplication. A failed send is retried on a later scheduled observation if stock remains available. An acknowledgement followed by a failed state save may cause a duplicate; exactly-once phone delivery cannot be guaranteed.

The collector checks the current page's full store list without a specific location filter. This covers stores exposed by that US page, not an independently verified list of every physical store. A checked in-stock filter and enabled store row is availability evidence, not a reservation or purchase guarantee.

## Free deployment and Windows recovery

The repository is public and uses a standard GitHub-hosted Ubuntu runner. No paid runner or Cloudflare resource is needed. The ntfy destination is configured as repository secret `NTFY_URL`, with optional `NTFY_TOKEN` if authentication is required. Do not publish these values in code.

For a fresh Windows setup, no local programming tools are required: create a public dedicated GitHub repository, upload these source files and the two package files, then create `.github/workflows/monitor.yml` with GitHub's file editor. Under Settings → Secrets and variables → Actions, add `NTFY_URL`. Validate 9216 and 3317 with the default no-push option before enabling the schedule. The default GitHub token is supplied by Actions; do not create a personal token for this script.

To inspect locally with Node.js 22 installed, run `npm ci` and `node --test stock-policy.test.mjs` from this folder. Unit-test fixtures do not enter the live inventory state. The local Windows PC is not used by the deployed schedule.

GitHub may disable a public schedule after 60 days without repository activity. Check Actions if notifications appear inactive. Website layout, access policy, networking and stock can change; failed reads require investigation rather than bypassing protections.

Sources: [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [public runner billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
