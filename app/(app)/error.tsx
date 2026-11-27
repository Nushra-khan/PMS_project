"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-tide">
        Something went wrong
      </p>
      <h1 className="text-2xl font-semibold text-ink">
        We could not load this page
      </h1>
      <p className="text-sm leading-6 text-ink/70">
        The workspace data could not be loaded, usually because the database is
        unreachable. Nothing is shown rather than showing an empty or incomplete
        page. Try again in a moment.
      </p>
      {error.digest ? (
        <p className="text-xs text-ink/50">Reference: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide"
      >
        Try again
      </button>
    </main>
  );
}
