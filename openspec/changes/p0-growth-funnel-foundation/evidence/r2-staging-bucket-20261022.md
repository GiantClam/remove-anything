# R2 staging bucket provisioning — 2026-10-22

The isolated R2 buckets were created through the authenticated Wrangler session.
No production bucket was modified, and no runtime object credentials or API
secrets were written to the repository or chat.

- Bucket: `remove-anything-storage-staging`
- Account: the existing Remove Anything Cloudflare account
- Created: `2026-10-22T01:31:50.113Z`
- Location: `WNAM`
- Storage class: `Standard`
- Initial object count: `0`
- Initial size: `0 B`
- Public `r2.dev` URL: disabled
- Custom domains: none

Composition result bucket:

- Bucket: `remove-anything-storage-staging-private`
- Created: `2026-10-22T01:41:26.269Z`
- Storage class: `Standard`
- Public `r2.dev` URL: disabled
- Custom domains: none

The application requires this second bucket because `R2_PRIVATE_BUCKET` must be
different from `R2_BUCKET` for background-composition results.

The bucket now exists as an isolated storage target for the staging Preview.
The remaining storage gate is to create a bucket-scoped Object Read & Write
token and configure the branch-specific `R2_*` variables in Vercel. Those
credentials must be entered through the service dashboard or an approved
secret-management command and must not be committed here.

This provisioning result does not close provider, application, analytics,
payment, retention, or full OpenSpec acceptance gates.
