/** Shared bound for explicitly supplied draft, record, and display text. No decoding. */
export function isSupportedText(content) {
  return typeof content === "string" && Buffer.byteLength(content) <= 65_536
    && Buffer.from(content).toString("utf8") === content
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(content);
}
