/**
 * Build the inline `#google-analytics` bootstrap that runs before React hydrates.
 *
 * CRITICAL: The returned string is embedded as Next.js <Script> children via a
 * normal JS template literal in the caller OR returned from here. Do NOT put a
 * regex literal that uses `\/` escapes into a normal template literal — template
 * evaluation turns `\/` into `/`, so `/\/g\/collect/` becomes `//g/collect/` which
 * starts a line comment, the rest of the bootstrap never runs, and `window.gtag`
 * stays undefined (no `/g/collect`, no `_dbg=1`). Prefer indexOf / new RegExp.
 */
export function buildGaInlineScript(gaId: string): string {
  const idLiteral = JSON.stringify(gaId);

  return `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          (function () {
            var debug = /(?:^|[?&])debug_mode=(?:1|true)(?:&|$)/.test(location.search);
            var cfg = { send_page_view: false, anonymize_ip: true };
            if (debug) {
              cfg.debug_mode = true;
              gtag('set', { debug_mode: true });
              // gtag config debug_mode alone often serializes as ep.debug_mode.
              // DebugView reliably keys off collect query _dbg=1 (Tag Assistant /
              // GA Debugger). Patch transport so ?debug_mode=1 always sets it.
              function withDbg(url) {
                if (typeof url !== 'string') return url;
                // indexOf (not a slash-escaped regex literal) — survives template embedding.
                if (url.indexOf('/g/collect') === -1 && url.indexOf('/collect?') === -1) return url;
                if (/[?&]_dbg=/.test(url)) return url;
                return url + (url.indexOf('?') >= 0 ? '&' : '?') + '_dbg=1';
              }
              try {
                if (navigator.sendBeacon) {
                  var beacon = navigator.sendBeacon.bind(navigator);
                  navigator.sendBeacon = function (url, data) {
                    return beacon(withDbg(url), data);
                  };
                }
              } catch (e) {}
              try {
                var origFetch = window.fetch;
                window.fetch = function (input, init) {
                  if (typeof input === 'string') {
                    return origFetch.call(this, withDbg(input), init);
                  }
                  if (input && typeof Request !== 'undefined' && input instanceof Request) {
                    var patched = withDbg(input.url);
                    if (patched !== input.url) {
                      return origFetch.call(this, new Request(patched, input), init);
                    }
                  }
                  return origFetch.call(this, input, init);
                };
              } catch (e) {}
              try {
                var XO = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function (method, url) {
                  var args = Array.prototype.slice.call(arguments);
                  if (typeof url === 'string') args[1] = withDbg(url);
                  return XO.apply(this, args);
                };
              } catch (e) {}
            }
            gtag('config', ${idLiteral}, cfg);
          })();
        `;
}

/** Detect the production bug where `\/` in a template became a `//` comment. */
export function gaInlineScriptHasCommentBug(script: string): boolean {
  return /!\s*\/\/g\/collect/.test(script);
}
