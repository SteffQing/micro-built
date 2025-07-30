import FeaturesSection from "@/ui/home/features";
import HeroSection from "@/ui/home/hero";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
      </main>
      <footer className="border-t bg-background py-6 text-center text-sm text-muted-foreground">
        <div className="px-4 md:px-6">
          <p>&copy; {new Date().getFullYear()} Microbuilt Prime. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
