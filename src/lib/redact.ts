// Redact common API-key patterns before any error message is logged
// or re-thrown. Guards against accidental key disclosure if an
// upstream error includes auth material in its message.
//
// Standalone (no voyage/anthropic imports) so it can be pulled into
// the Next.js bundle without dragging in vendor SDKs that don't
// resolve under Turbopack.

export function redactSecrets(message: string): string {
  return message
    .replace(/pa-[A-Za-z0-9_-]{20,}/g, "[REDACTED:voyage-key]")
    .replace(/voyage-[A-Za-z0-9_-]{20,}/g, "[REDACTED:voyage-token]")
    .replace(/sk-ant-[A-Za-z0-9_-]{20,}/g, "[REDACTED:anthropic-key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]{20,}/gi, "Bearer [REDACTED]")
    .replace(/x-api-key:\s*[A-Za-z0-9._-]+/gi, "x-api-key: [REDACTED]");
}
