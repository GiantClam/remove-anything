# GSC authenticated property verification receipt

Observed: 2026-10-29 23:35 Asia/Shanghai (CST, UTC+8).

## Scope

Close the authenticated Search Console property gate that DNS-only evidence could not close (`evidence/gsc-domain-dns-20261021.md`). This receipt proves the account holder’s Search Console property for `remove-anything.com` is present, verified enough for Google to collect impressions/clicks, and actively emailing performance digests. It does **not** start the 28-day baseline by itself (GA4 DebugView full chain and other release gates remain open).

## Sources (authenticated mailbox)

Connected Gmail account `liulanggoukk@gmail.com` (project account holder). Sender for all items below: `Google Search Console Team <sc-noreply@google.com>`. No secrets recorded.

| Message date (UTC) | Asia/Shanghai | Subject / fact | Message id |
| --- | --- | --- | --- |
| 2026-04-14T08:27:01Z | 2026-04-14 16:27 CST | 「监控 remove-anything.com 获得的 Google 搜索流量」— addressed to the site owner; Google confirms impression collection in Search Console began **2026-04-12**; footer states the site is listed in Search Console | `19d8b19dc8ef8323` |
| 2026-10-04T23:04:17Z | 2026-10-05 07:04 CST | 「恭喜，您的网站在 28 天内获得 80 次点击！」for `remove-anything.com` (milestone as of 2026-09-30) | `1a10929352ed8dc0` |
| 2026-10-06T01:48:23Z | 2026-10-06 09:48 CST | September performance digest for `remove-anything.com`: **87** web clicks, **1.4K** web impressions; top pages include `/`, `/batch-watermark-removal`, `/ar/change-background-color` | `1a10ee5cb42fdb9d` |

Supporting cross-check (not GSC itself): Bing Webmaster Tools emailed the same mailbox on 2026-06-27 that ownership role on `https://remove-anything.com/` was synced from Google Search Console account `liulanggoukk@gmail.com`.

## DNS (reconfirmed this turn)

`google-site-verification=h5Q0PoF_r_TaWzXI6v5s_Je7DjMT1eDmyDULl2bgnhk` still published for `remove-anything.com` via Google Public DNS (`8.8.8.8`) and Cloudflare DNS (`1.1.1.1`) on 2026-10-29 23:35 CST.

## Method notes / limits

- No Search Console MCP connector is installed in this bot session; the Search Plugins catalog tools were not available to the executor, so the UI property list was not opened in a browser this turn.
- Authenticated Gmail receipts from `sc-noreply@google.com` naming `remove-anything.com` as a Search Console property with ongoing impressions/clicks are accepted as the property-verification receipt.
- Property resource string in prior account notes remains `sc-domain:remove-anything.com`; emails name the domain `remove-anything.com` (domain property). A live Settings → Ownership screenshot was not captured this turn and is optional follow-up, not required to accept ownership once Google is already collecting and digesting data for that mailbox.
- This does **not** prove three core-tool landing pages currently meet the separate 28-day impression gate by itself; the September digest shows homepage + batch/locale pages, not a complete six-tool matrix export.

## Decision

**GSC domain create/verify (tasks.md account prerequisite): CLOSED** with authenticated mailbox receipts + DNS reconfirm.
