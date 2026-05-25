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
      <p className="mt-3 max-w-2xl text-sm text-[var(--color-fg-muted)]">
        Ask in plain English. Postmark embeds your query, ranks past experiments by
        semantic similarity, and writes a short synthesis with citations.
      </p>

      <div className="mt-10">
        <SearchBar />
      </div>
    </main>
  );
}
