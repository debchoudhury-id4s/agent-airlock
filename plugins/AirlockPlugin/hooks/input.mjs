/**
 * Copilot sends one JSON event on stdin. Hooks emit newline-delimited JSON on
 * stdout, so diagnostics must use progress events rather than plain text.
 */
export async function readHookInput(limit = 1_048_576) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > limit) throw new Error("Hook input exceeds the supported size.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

export function progress(message) {
  emit({ type: "progress", message, temporary: true });
}
