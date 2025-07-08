
export function withTrailingSlash(url: string): string {
  if (url.endsWith('/')) {
    return url;
  }
  return `${url}/`;
}