import Link from "next/link";
import { Icon, icons } from "@/components/icon";
import { type Faq, HOME_FAQ } from "@/ui/faq/questions";

/** Questions as an accordion: native <details>, so it works without JavaScript and search engines see the answers. */
export function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="divide-y border-y">
      {items.map(({ id, q, a }) => (
        <details key={id} id={id} className="group scroll-mt-24 py-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md text-left text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {q}
            <Icon
              icon={icons.plus}
              size={20}
              className="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
            />
          </summary>
          <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">{a}</p>
        </details>
      ))}
    </div>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold text-primary">FAQ</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Questions, answered</h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            The short version of how MicroBuilt loans work.
          </p>
          <Link
            href="/faq"
            className="mt-6 inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
          >
            See all questions
            <Icon icon={icons.arrowRight} size={16} />
          </Link>
        </div>
        <FaqList items={HOME_FAQ} />
      </div>
    </section>
  );
}
