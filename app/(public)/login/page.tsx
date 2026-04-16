import { AuthPanel } from "@/components/auth-panel";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-canvas bg-dashboard-radial px-4 py-8 text-ink">
      <div className="mx-auto max-w-4xl space-y-8">
        <section className="rounded-[2.4rem] border border-ink/10 bg-ink px-8 py-10 text-white shadow-soft">
          <p className="text-xs uppercase tracking-[0.24em] text-white/60">
            Secure authentication
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight">
            PMS Pro
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/74">
            Sign in or create your account to access the performance, goals,
            probation, and review workflows for your assigned role.
          </p>
        </section>

        <section className="mx-auto max-w-2xl">
          <AuthPanel />
        </section>
      </div>
    </main>
  );
}
