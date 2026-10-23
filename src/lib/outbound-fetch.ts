export function createSafeOutboundFetch(baseFetch: typeof globalThis.fetch): typeof globalThis.fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    // Temporary defence in depth for CVE-2026-111497 while managed runtimes roll out.
    // Upstream servers must still be trusted: this is not a runtime patch.
    headers.set("accept-encoding", "gzip, deflate");
    return baseFetch(input, { ...init, headers });
  };
}
