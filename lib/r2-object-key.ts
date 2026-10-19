/** Resolve only an object below the configured public R2 origin and path. */
export function getR2ObjectKey(
  url: string | null | undefined,
  configuredR2Url: string,
): string | null {
  if (!url) return null;
  try {
    const output = new URL(url);
    const base = new URL(configuredR2Url);
    if (
      output.protocol !== "https:" ||
      base.protocol !== "https:" ||
      output.username || output.password ||
      base.username || base.password ||
      output.origin !== base.origin
    ) {
      return null;
    }
    const prefix = `${base.pathname.replace(/\/$/, "")}/`;
    if (!output.pathname.startsWith(prefix)) return null;
    const key = decodeURIComponent(output.pathname.slice(prefix.length));
    if (!key || key.startsWith("/") || key.split("/").some((segment) => segment === "." || segment === "..")) {
      return null;
    }
    return key;
  } catch {
    return null;
  }
}
