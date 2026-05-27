// Inline auto-linker for exp_NNN references in free-form prose.
// Handles four shapes the corpus and Phase-4 Opus stream actually emit:
//   exp_010              (bare)
//   [exp_010]            (citation chip)
//   **exp_010**          (markdown-bold bare)
//   **[exp_010]**        (markdown-bold citation)
//
// Asymmetric brackets ([exp_010 or exp_010]) are NOT matched — they'd
// render as visually broken link text. The regex permits either both
// brackets or neither.
//
// Pure renderer; safe in both server and client components.

import Link from "next/link";
import type { ReactNode } from "react";

const CHIP_CLASS =
  "mx-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[0.75rem] text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)] hover:underline";

export default function ExperimentLink({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let match: RegExpExecArray | null;

  // Fresh regex per call so /g state (lastIndex) is never stale.
  const pattern = /(\*\*)?(\[exp_\d{3}\]|exp_\d{3})(\*\*)?/g;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));

    const inner = match[2]; // "exp_010" or "[exp_010]"
    const bare = inner.replace(/^\[|\]$/g, ""); // -> "exp_010"
    const bold = Boolean(match[1] && match[3]);

    parts.push(
      <Link
        key={`exp-${i++}-${match.index}`}
        href={`/experiments/${bare}`}
        className={`${CHIP_CLASS}${bold ? " font-semibold" : ""}`}
      >
        {inner}
      </Link>,
    );

    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
