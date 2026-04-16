"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type AuthMode = "sign_in" | "sign_up";

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin (HR)" }
];

export function AuthPanel() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setErrorMessage("Supabase environment variables are missing.");
      setFeedback(null);
      return;
    }

    setErrorMessage(null);
    setFeedback(null);

    if (mode === "sign_in") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      startTransition(() => {
        router.push("/dashboard");
        router.refresh();
      });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role
        }
      }
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      startTransition(() => {
        router.push("/dashboard");
        router.refresh();
      });
      return;
    }

    setFeedback(
      "Account created. If email confirmation is enabled in Supabase, verify your email and then sign in."
    );
    setMode("sign_in");
  }

  return (
    <section className="rounded-[2rem] border border-ink/10 bg-panel p-6 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-tide">
            Real authentication
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-ink">
            Sign in or create your account
          </h2>
        </div>

        <div className="rounded-full border border-ink/10 bg-white p-1">
          <button
            type="button"
            onClick={() => setMode("sign_in")}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition",
              mode === "sign_in" ? "bg-ink text-white" : "text-ink/70"
            )}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("sign_up")}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition",
              mode === "sign_up" ? "bg-ink text-white" : "text-ink/70"
            )}
          >
            Sign up
          </button>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-ink/70">
        Use your email and password to access the PMS workspace. Every protected
        route in the app now requires authentication before any dashboard or data
        can be viewed.
      </p>

      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        {mode === "sign_up" ? (
          <>
            <label className="grid gap-2 text-sm font-medium text-ink">
              Full name
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
                placeholder="Your full name"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-ink">
              Role
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        <label className="grid gap-2 text-sm font-medium text-ink">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
            placeholder="name@company.com"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-2xl border border-ink/15 bg-white px-4 py-3 outline-none"
            placeholder="Minimum 6 characters"
            required
            minLength={6}
          />
        </label>

        {feedback ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {feedback}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-tide disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? "Working..."
            : mode === "sign_in"
              ? "Sign in to PMS"
              : "Create account"}
        </button>
      </form>
    </section>
  );
}
