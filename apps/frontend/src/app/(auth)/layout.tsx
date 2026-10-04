import { LogoColored } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
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
        <aside className="relative hidden min-h-0 overflow-hidden rounded-lg border border-border bg-muted lg:flex lg:w-[48%] xl:w-1/2">
          <Image
            src={
              pathname === "/sign-up"
                ? "/man_illustration.png"
                : "/login_illistration.jpg"
            }
            alt="MicroBuilt Sign Up"
            fill
            sizes="(min-width: 1024px) 50vw, 0px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/10 to-background/60" />
          <div className="absolute left-5 top-5 rounded-md bg-background/95 p-2 shadow-lg backdrop-blur">
            <LogoColored className="text-foreground" />
          </div>
          <div className="absolute bottom-5 left-5 right-5 rounded-lg border border bg-background/80 p-5 text-left shadow-2xl backdrop-blur-md xl:p-6">
            <p className="mb-3 text-xs font-medium uppercase text-muted-foreground">
              Secure lending workspace
            </p>
            <h2 className="max-w-xl text-xl font-semibold leading-tight text-foreground xl:text-2xl">
              Bring faster loan decisions into one controlled platform.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Manage customer onboarding, approvals, repayments, and reporting
              with MicroBuilt.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-foreground">
              <div className="rounded-md bg-foreground/5 p-3">
                <p className="text-lg font-semibold">24/7</p>
                <p className="text-xs text-muted-foreground">Account access</p>
              </div>
              <div className="rounded-md bg-foreground/5 p-3">
                <p className="text-lg font-semibold">Audit</p>
                <p className="text-xs text-muted-foreground">Traceable actions</p>
              </div>
            </div>
          </div>
        </aside>
        <section className="relative flex min-h-0 w-full flex-col thin-scroll overflow-y-auto rounded-lg border bg-background shadow-sm lg:w-[52%] xl:w-1/2">
          <div className="flex h-full min-h-0 flex-col px-4 py-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex shrink-0 items-center justify-between lg:hidden">
              <div className="rounded-md bg-background/95 p-1.5 shadow-xs">
                <LogoColored className="text-foreground" />
              </div>
              <ThemeToggle />
            </div>
            <div className="absolute right-8 top-8 hidden lg:block">
              <ThemeToggle />
            </div>
            <div className="flex min-h-0 flex-1">
              <div className="m-auto w-full max-w-[520px] py-4">{children}</div>
            </div>
</div>
        </section>
      </div>
    </main>
  );
}
