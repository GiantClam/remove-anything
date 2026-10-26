# Real staging output evidence — 2026-10-26

Scope: Vercel Preview deployment `dpl_9wrHh79MTx6PKgN28hkAQd1iF2zd` (`https://remove-anything-6s2qmbwyi-giantclams-projects.vercel.app`), the authorized Supabase staging branch `remove-anything-p0-staging`, and staging R2 only. Production was not changed.

## Transparent PNG

- Route: `/transparent-png-maker`.
- Browser uploaded the real `portrait_before.png` fixture.
- `POST /api/generate` returned HTTP 200 and created RunningHub task `2114697846702960641`.
- Polling reached success and the real download returned HTTP 200, `image/png`.
- Downloaded Blob: `400×400`, `418,801` bytes.
- Decoded pixels: `71,911` pixels with alpha below 255; `alphaMin=0`, `alphaMax=255`, `alphaMean=144.99`; corner samples include `[0,0,0,0]`.

This closes the transparent-PNG real provider, storage, download, and alpha-pixel acceptance gate.

## White background and selected color composition

Using the same real provider output, the page's actual client Canvas composition was exercised and exported to PNG Blobs:

- White background: `400×400`, `247,822` bytes, `notOpaque=0`, all four corners `[255,255,255,255]`.
- Selected `#4D96FF`: `400×400`, `246,540` bytes, `notOpaque=0`, all four corners `[77,150,255,255]`.

These checks prove the composition and pixel-output logic. They do not close the independent provider submission and page-download flows for `/white-background-maker` and `/change-background-color`: repeating file-input submission on those pages did not produce a new `POST /api/generate`, so no new task could be tied to each page's own end-to-end flow. Keep both gates open until each route produces its own real provider task and download receipt.

## Watermark latest recheck

- A fresh real JPEG submission on the same Preview created `watermark_removal_tasks.id=7` and RunningHub task `2114698997288620034`.
- The task reached `succeeded`; the private download returned HTTP 200 with `application/zip` and contained `image_1.png` under the staging R2 private `watermark-removal/processed/` prefix.
- Durable analytics contains `event_id=result_downloaded:task:remove-watermark:7`, `name=result_downloaded`, `tool_slug=remove-watermark`, and `task_id=7`.
- Negative input boundaries also held: an untrusted Preview URL returned HTTP 400 `UNSUPPORTED_IMAGE_URL`, and PNG bytes with a forged MIME returned HTTP 415 `UNSUPPORTED_IMAGE_FORMAT`.

## Current cross-tool evidence

The staging database currently contains successful real records for background removal (`7`, `13`, `14`, `18`), object removal (`1`, `2`), watermark removal (`1`, `4`, `7`), and Sora2 `task_data.id=4`. Namespaced download receipts include `result_downloaded:task:remove-watermark:4/7`, `result_downloaded:task:remove-background:18`, and `result_downloaded:task:sora2-video-watermark-removal:4`.

## Sora2 video watermark removal

- Existing staging record: `task_data.id=4`, provider task `2114680937567707138`, private R2 result under `sora2-video-watermark-removal/processed/`.
- The original signed anonymous principal cookie was reused for the status and download requests.
- Status reached `succeeded`; the non-preview application download returned HTTP 200 and `Content-Type: video/mp4`.
- Downloaded file: approximately `2.1 MB`; `file` identified ISO media and the first bytes were `00 00 00 14 66 74 79 70`, confirming an MP4 `ftyp` box.
- Durable staging analytics contains `result_downloaded:task:sora2-video-watermark-removal:4`.

This closes the Sora2 provider, private R2, principal-bound application download, byte validation, and namespaced analytics acceptance gate.
