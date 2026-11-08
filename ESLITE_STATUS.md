# Eslite Owala monitor: cloud validation failed

Checked 2026-11-08. This is NOT an active stock monitor.

The ordinary GitHub-hosted Ubuntu/Chromium validation ran successfully through installation and policy tests, but Eslite returned HTTP 403 and `Attention Required! | Cloudflare` for BOTH:

- Target Owala FreeSip Tritan 740ml pink: `10052271402683055271007`, at 10:52:20 UTC.
- Available browser reference BlenderBottle Kuromi 740ml: `10052271402682611915003`, at 10:52:20 UTC.

[Actual failed cloud run](https://github.com/tmz-12/popmart-9216-monitor/actions/runs/42473227502)

[Screenshots and observations artifact](https://github.com/tmz-12/popmart-9216-monitor/actions/runs/42473227502/artifacts/13614725458) (GitHub retention: 3 days)

Both results are `unknown`, not sold-out. No site access controls were bypassed. A normal interactive browser previously displayed the target's stock-notification button and the reference's enabled cart/buy buttons; that does not establish runner access.

The collector, classification tests, isolated state integration, and ntfy message implementation are prepared. Notification tests use an injected mock HTTP function and do not send real notifications. `eslite-monitor.mjs` is NOT connected to any scheduled job. `eslite-validation.yml` is manual-only after this failed pilot. The existing POP MART workflow and state are unchanged.

Prepared production integration reuses the repository's `NTFY_URL` and optional `NTFY_TOKEN`, saves to `eslite-state.json` on `monitor-state`, and uses the existing reconciled state-write retries. It will only send for the target, never for the control. Unknown readings fail before persistence or notification. Continuous stock is deduplicated; confirmed sell-out rearms a future alert. No failure/recovery pushes are implemented.

Before enabling production, obtain a permitted readable inventory source or resolve website access with Eslite, then run target and positive control successfully from the intended runtime. Verify repeated scheduled reads, durable state and real notification delivery separately. A working local browser, passing fixture tests, or a green installation step is not proof of a working cloud monitor. Do not enable this schedule merely to make the workflow appear complete.

Checks: `node --test eslite-policy.test.mjs eslite-notify.test.mjs stock-policy.test.mjs`; syntax check `eslite-monitor.mjs` and `eslite-collect.mjs`.
