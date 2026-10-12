import type { Metadata } from "next";
import Link from "next/link";
import { Icon, icons } from "@/components/icon";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { openGraph } from "@/lib/seo";
import { SUPPORT_HREF } from "@/lib/support";
import { FAQ_GROUPS, faqJsonLd } from "@/ui/faq/questions";
import { ClosingCta, SiteFooter } from "@/ui/home/closing";
import { FaqList } from "@/ui/home/faq";
import { PageHeader } from "@/ui/marketing/page-header";

const title = "Frequently asked questions · MicroBuilt Prime";
const description =
  "Who can apply, what a salary-backed loan costs, how monthly deductions work, paying off early, and keeping your account safe.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/faq" },
  openGraph: openGraph({ title, description, path: "/faq" }),
};

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd data={faqJsonLd()} />
      <main className="flex-1">
        <PageHeader
          seed="faq-page"
          title="Frequently asked questions"
          lead="How MicroBuilt Prime loans work, from applying to your last deduction."
        />

        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[14rem_1fr] lg:gap-16 lg:px-8">
          <nav aria-label="Topics" className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-sm font-semibold">Topics</p>
            <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {FAQ_GROUPS.map((group) => (
                <li key={group.id}>
                  <a
                    href={`#${group.id}`}
                    className="block rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:border-0 lg:px-2"
                  >
                    {group.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="grid min-w-0 gap-14">
            {FAQ_GROUPS.map((group) => (
              <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="scroll-mt-24">
                <h2 id={`${group.id}-title`} className="mb-4 text-2xl font-semibold tracking-tight">
                  {group.title}
                </h2>
                <FaqList items={group.items} />
              </section>
            ))}

            <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <h2 className="text-lg font-semibold">Still have a question?</h2>
                <p className="mt-1 text-muted-foreground">Ask our assistant, or pass your question to the team.</p>
              </div>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={SUPPORT_HREF}>
                  <Icon icon={icons.message} size={18} />
                  Help &amp; support
                </Link>
              </Button>
            </section>
          </div>
        </div>

        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
