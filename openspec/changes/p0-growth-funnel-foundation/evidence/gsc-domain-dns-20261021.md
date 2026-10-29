# Search Console domain verification DNS evidence

Observed: 2026-10-21 02:27 UTC. Read-only TXT lookups for `remove-anything.com` through Cloudflare DNS (`1.1.1.1`), Google Public DNS (`8.8.8.8`), and the workstation resolver returned the same `google-site-verification` record.

This confirms that a Google verification TXT record is publicly published and consistently visible through the queried resolvers. It does not confirm that the `sc-domain:remove-anything.com` property is present and marked verified in Search Console, that Search Console data is available, or that impressions/clicks exist. Attach a current authenticated Search Console property-verification receipt before closing the account-setup task or starting the 28-day baseline.
