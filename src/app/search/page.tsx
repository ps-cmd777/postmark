import SearchBar from "@/components/SearchBar";

export const metadata = {
  title: "Search · Postmark",
  description: "Semantic search across past A/B experiments.",
};

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
        postmark · search
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Have we tested this before?
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-fg-muted)]">
        Find past experiments related to any topic. Type a question or theme
        below — the system reads all 50 experiments and returns the most
        relevant ones, with an AI-written summary.
      </p>

      <div className="mt-10">
        <SearchBar />
      </div>
    </main>
  );
}
