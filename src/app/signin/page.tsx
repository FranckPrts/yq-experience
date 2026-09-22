import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/dal";
import SignInForm from "./form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await currentUser()) redirect(next ?? "/projects");

  return (
    <main className="flex min-h-screen items-center justify-center bg-void p-6 text-paper">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-sm">yq-experiences</h1>
        <p className="mb-6 text-xs text-dim">
          Sign in to manage your projects.
        </p>
        <SignInForm next={next ?? ""} />
        <p className="mt-6 text-[11px] leading-relaxed text-dim">
          Accounts are created by invitation only. If you need one, ask an
          administrator to send you a link.
        </p>
      </div>
    </main>
  );
}
