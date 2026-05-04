// Experiment detail page (Live Artifact). Phase 5.
export default async function ExperimentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-mono text-sm text-zinc-500">{id}</h1>
      <p className="mt-4 text-zinc-400">Experiment detail — coming in Phase 5.</p>
    </main>
  );
}
