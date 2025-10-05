/**
 * Cloudflare Media Transformations helpers.
 * Docs: https://developers.cloudflare.com/stream/transform-videos/
 */

interface BuildOptions {
  width?: number;
  height?: number;
  fit?: 'contain' | 'scale-down' | 'cover';
  time?: string; // e.g. '1s'
  duration?: string; // e.g. '3s'
  audio?: boolean; // default true
  filename?: string;
}

/**
 * Build a Cloudflare Media Transformations URL for a given public source URL.
 * Example result:
 *   https://{zone}/cdn-cgi/media/mode=video,width=704,height=1280,fit=scale-down/https%3A%2F%2F{zone}%2Fuploads%2Fkey.mp4
 */
export function buildMediaTransformUrl(zoneHost: string, sourceUrl: string, opts: BuildOptions = {}): string {
  const params: string[] = ['mode=video'];
  if (typeof opts.time === 'string' && opts.time.length > 0) params.push(`time=${opts.time}`);
  if (typeof opts.duration === 'string' && opts.duration.length > 0) params.push(`duration=${opts.duration}`);
  if (typeof opts.width === 'number') params.push(`width=${opts.width}`);
  if (typeof opts.height === 'number') params.push(`height=${opts.height}`);
  if (opts.fit) params.push(`fit=${opts.fit}`);
  if (typeof opts.audio === 'boolean') params.push(`audio=${opts.audio ? 'true' : 'false'}`);

  const optionsStr = params.join(',');
  return `https://${zoneHost}/cdn-cgi/media/${optionsStr}/${sourceUrl}`;
}

/**
 * Prewarm a transformation URL so that Cloudflare generates and caches the output.
 * We use a small Range GET to avoid downloading the full file.
 */
export async function prewarmTransformUrl(transformUrl: string): Promise<void> {
  try {
    await fetch(transformUrl, { headers: { Range: 'bytes=0-1023' } });
  } catch (e) {
    // Non-critical: swallow errors, as prewarm is best-effort.
  }
}

/**
 * Wait until the transformation output is ready on Cloudflare edge.
 * Strategy: poll with small Range GET and verify content-type is video/mp4 and some bytes returned.
 */
export async function waitForTransformReady(
  transformUrl: string,
  options: { timeoutMs?: number; intervalMs?: number; backoffFactor?: number; maxIntervalMs?: number } = {}
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? 120000; // default 120s
  let intervalMs = options.intervalMs ?? 1000; // start 1s
  const backoffFactor = options.backoffFactor ?? 1.5;
  const maxIntervalMs = options.maxIntervalMs ?? 5000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(transformUrl, { headers: { Range: 'bytes=0-1023' } });
      if (r.ok) {
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('video/mp4')) {
          const buf = await r.arrayBuffer();
          if (buf.byteLength > 0) return true;
        }
      }
    } catch {}
    await new Promise((res) => setTimeout(res, intervalMs));
    intervalMs = Math.min(Math.floor(intervalMs * backoffFactor), maxIntervalMs);
  }
  return false;
}


