export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { createSafeOutboundFetch } = await import("./lib/outbound-fetch");
    globalThis.fetch = createSafeOutboundFetch(globalThis.fetch);
    // Only runtime metadata; never log environment values or request data.
    console.info("[GENKS runtime]", JSON.stringify({ node: process.version }));
  }
}
