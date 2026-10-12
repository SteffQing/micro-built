import { CalloutArt } from "@/components/callouts/callout-art";

/** The banner at the top of a public page (as on /support): the page's title on a strip of brand art. */
export function PageHeader({ seed, eyebrow, title, lead }: { seed: string; eyebrow?: string; title: string; lead: string }) {
  return (
    <section className="relative overflow-hidden border-b">
      <CalloutArt kind="BRAND" seed={seed} cols={32} rows={5} className="absolute inset-0 h-full w-full opacity-90" />
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="inline-block max-w-2xl rounded-2xl bg-background/90 px-5 py-4 shadow-sm backdrop-blur-sm">
          {eyebrow && <p className="text-sm font-semibold text-primary">{eyebrow}</p>}
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-pretty text-muted-foreground">{lead}</p>
        </div>
      </div>
    </section>
  );
}
