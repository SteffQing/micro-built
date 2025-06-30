import { LogoColored } from "@/components/logo";
import Image from "next/image";
import { headers } from "next/headers";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-current-path");

  return (
    <div className="h-[100dvh] flex p-6 bg-muted gap-6">
      <div className="hidden lg:flex lg:w-1/2 relative rounded-xl overflow-hidden">
        <Image
          src={
            pathname === "/sign-up"
              ? "/man_illustration.png"
              : "/login_illistration.jpg"
          }
          alt="MicroBuilt Sign Up"
          fill
          className="object-cover"
        />
        {/* <div className="absolute inset-0" /> */}
        <div className="absolute top-8 left-4 bg-white p-2 rounded-lg">
          <LogoColored />
        </div>
        <div className="absolute bottom-8 left-1/2  -translate-x-1/2 text-left p-4 bg-gray-50/10 rounded-2xl backdrop-blur-sm w-[90%] max-w-2xl">
          <h2 className="text-xl font-semibold text-white">
            {"Let's Bring Your Financial Goals to Life"}
          </h2>
          <p className="text-muted-foreground text-sm">
            Access affordable loans anytime, anywhere with MicroBuilt
          </p>
          <div className="flex gap-2 mt-6 w-fit mx-auto">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <div className="w-2 h-2 bg-white/50 rounded-full"></div>
            <div className="w-2 h-2 bg-white/50 rounded-full"></div>
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/2  p-6 bg-background rounded-2xl">
        {children}
      </div>
    </div>
  );
}
