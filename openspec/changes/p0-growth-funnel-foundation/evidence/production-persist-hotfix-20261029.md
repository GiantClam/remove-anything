# Production persist hotfix — 2026-10-29 (Asia/Shanghai)

## Root cause
`process-queue` cron wrote raw RunningHub provider URLs into task `output_*` columns and marked tasks `succeeded`, racing the Vercel poll path that must migrate bytes into private R2 first. Poll failure handling could also leave provider URLs in the DB.

## Fix
PR #12 / merge `b038d7b` / deploy `dpl_9XxEku5UqcWt5XrnPogyEzz1wUiH`.

## Canary
Watermark `2115743351121866754` / record `6`: create 200 → succeeded with R2 output → download 200 ZIP.
