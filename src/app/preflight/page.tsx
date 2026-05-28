"use client";

import { useRef, useState } from "react";
import PreflightForm from "@/components/PreflightForm";
import PreflightResult, {
  type PreflightResultHandle,
} from "@/components/PreflightResult";

export default function PreflightPage() {
  const resultRef = useRef<PreflightResultHandle>(null);
  const [running, setRunning] = useState(false);

  return (
    <main className="mx-auto max-w-[720px] px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
        postmark · pre-flight
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Before you launch this experiment.
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--color-fg-muted)]">
        Paste a hypothesis you&rsquo;re thinking about testing. Postmark will
        warn you about similar past experiments that failed — and surface ones
        that succeeded.
      </p>

      <div className="mt-10">
        <PreflightForm
          disabled={running}
          onSubmit={(h) => resultRef.current?.run(h)}
        />
      </div>

      <div className="mt-10">
        <PreflightResult ref={resultRef} onStreamingChange={setRunning} />
      </div>
    </main>
  );
}
