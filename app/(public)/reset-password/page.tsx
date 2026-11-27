import { ResetPasswordForm } from "@/components/reset-password-form";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-canvas bg-dashboard-radial px-4 py-8 text-ink">
      <section className="mx-auto max-w-md rounded-[2rem] border border-ink/10 bg-panel p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-tide">
          Account recovery
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-ink">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          You opened a reset link from your email. Pick a new password of at least 8
          characters.
        </p>
        <div className="mt-6">
          <ResetPasswordForm />
        </div>
      </section>
    </main>
  );
}
