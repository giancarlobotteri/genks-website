export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Only runtime metadata; never log environment values or request data.
    console.info("[GENKS runtime]", JSON.stringify({ node: process.version }));
  }
}
