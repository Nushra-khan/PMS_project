"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage("Supabase environment variables are missing.");
      return;
    }

    if (password !== confirm) {
      setErrorMessage("The two passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage(
        error.message.includes("session")
          ? "This reset link has expired. Request a new one from the sign-in page."
          : error.message
      );
      return;
    }

    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  }

  const inputClass = "rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none";

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm font-medium text-ink">
        New password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
          minLength={8}
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-ink">
        Confirm new password
        <input
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className={inputClass}
          minLength={8}
          required
        />
      </label>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide disabled:opacity-60"
      >
        {isPending ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}
