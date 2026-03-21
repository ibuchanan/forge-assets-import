/**
 * Normalize Atlassian API URLs to relative paths for requestJira.
 *
 * requestJira requires relative paths. Assets HATEOAS links may include
 * absolute URLs, so we strip the origin when present.
 */
export function toRelativePath(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    const url = new URL(pathOrUrl);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  if (pathOrUrl.startsWith("//")) {
    const url = new URL(`https:${pathOrUrl}`);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  return pathOrUrl;
}
