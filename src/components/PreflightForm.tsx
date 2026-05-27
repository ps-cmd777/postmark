"use client";

// The hypothesis input. Lives separately from PreflightResult because
// the form's state is static (controlled textarea + submit button) and
// the result region is streaming — separate lifecycles, separate
// responsibilities. The parent page wires them together.

import { useState } from "react";

const PLACEHOLDER = `e.g. We want to require new users to set a profile photo before their first edit. Hypothesis: early creator-identity formation will lift D7 retention by 1.5pp+ via social anchoring. Targeted at free users, iOS + Android, US.`;

const MIN_CHARS = 20;
const MAX_CHARS = 2000;

interface Props {
  onSubmit: (hypothesis: string) => void;
  disabled: boolean;
}

export default function PreflightForm({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");

  const trimmed = value.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_CHARS;
  const canSubmit = trimmed.length >= MIN_CHARS && trimmed.length <= MAX_CHARS;

  return (
    <form
      onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!canSubmit || disabled) return;
        onSubmit(trimmed);
      }}
      className="flex flex-col gap-3"
    >
      <label
        htmlFor="hypothesis"
        className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]"
      >
        Hypothesis
      </label>
      <textarea
        id="hypothesis"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        maxLength={MAX_CHARS}
        placeholder={PLACEHOLDER}
        className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-4 py-3 text-sm leading-6 text-[var(--color-fg)] placeholder:text-[var(--color-fg-muted)] focus:border-[var(--color-accent)] focus:outline-none"
      />

      <div className="flex items-center justify-between text-xs text-[var(--color-fg-muted)]">
        <span className="font-mono">
          {trimmed.length} / {MAX_CHARS} chars
          {tooShort && (
            <span className="ml-2 text-amber-400">
              (need at least {MIN_CHARS})
            </span>
          )}
        </span>
        <button
          type="submit"
          disabled={!canSubmit || disabled}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {disabled ? "Running…" : "Run pre-flight check"}
        </button>
      </div>
    </form>
  );
}
