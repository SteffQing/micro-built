"use client";

import { CalloutArt } from "@/components/callouts/callout-art";

/** The callouts' brand mosaic, for server-rendered landing sections (CalloutArt builds its tiles in a hook). */
export function BrandMosaic({ className }: { className?: string }) {
  return <CalloutArt kind="BRAND" seed="microbuilt-landing" cols={24} rows={10} className={className} />;
}
