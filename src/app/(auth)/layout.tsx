import { LogoColored } from "@/components/logo";
import Image from "next/image";
import { headers } from "next/headers";

//THIS MUST BE SERVER  IN ORDER TO DYNAMICALLY RENDER THE IMAGES DIFFERENTLY ON LOGIN., SIGNUP AND RESET PASSWORD SCREEN

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-current-path");

  return (
    <main className="h-dvh max-h-dvh overflow-hidden bg-muted p-3 sm:p-4 lg:p-6">
      <div className="flex h-full min-h-0 gap-4 lg:gap-6">
        <aside className="relative hidden min-h-0 overflow-hidden rounded-lg border border-white/60 bg-black lg:flex lg:w-[48%] xl:w-1/2">
          <Image
            src={
              pathname === "/sign-up"
                ? "/man_illustration.png"
                : "/login_illistration.jpg"
            }
            alt="MicroBuilt Sign Up"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/60" />
          <div className="absolute left-5 top-5 rounded-md bg-white/95 p-2 shadow-lg backdrop-blur">
            <LogoColored />
          </div>
          <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-white/15 bg-black/35 p-5 text-left shadow-2xl backdrop-blur-md xl:p-6">
            <p className="mb-3 text-xs font-medium uppercase text-white/70">
              Secure lending workspace
            </p>
            <h2 className="max-w-xl text-xl font-semibold leading-tight text-white xl:text-2xl">
              Bring faster loan decisions into one controlled platform.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
              Manage customer onboarding, approvals, repayments, and reporting
              with MicroBuilt.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-white/85">
              <div className="rounded-md bg-white/10 p-3">
                <p className="text-lg font-semibold">24/7</p>
                <p className="text-xs text-white/60">Account access</p>
              </div>
              <div className="rounded-md bg-white/10 p-3">
                <p className="text-lg font-semibold">RBAC</p>
                <p className="text-xs text-white/60">Role control</p>
              </div>
              <div className="rounded-md bg-white/10 p-3">
                <p className="text-lg font-semibold">Audit</p>
                <p className="text-xs text-white/60">Traceable actions</p>
              </div>
            </div>
          </div>
        </aside>
        <section className="flex min-h-0 w-full flex-col overflow-hidden rounded-lg border bg-background shadow-sm lg:w-[52%] xl:w-1/2">
          <div className="flex h-full min-h-0 flex-col px-4 py-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex shrink-0 items-center justify-between lg:hidden">
              <LogoColored />
              <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                Secure portal
              </span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="w-full max-w-[520px]">{children}</div>
            </div>
            <p className="mt-4 hidden shrink-0 text-center text-xs text-muted-foreground sm:block">
              Protected by MicroBuilt session security.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
