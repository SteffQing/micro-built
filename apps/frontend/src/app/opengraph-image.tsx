import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

// The preview card shown when a link to any page is shared. Rendered once at build time.
export const alt = `${SITE_NAME}: salary-backed loans, repaid from your pay`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#8A0806";

export default async function OpengraphImage() {
  // Builds run from apps/frontend, so public/ is relative to it.
  const logo = await readFile(join(process.cwd(), "public/logo.svg"), "base64");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#ffffff",
        borderTop: `16px solid ${BRAND}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain elements, not next/image */}
      <img src={`data:image/svg+xml;base64,${logo}`} width={397} height={66} alt="" />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, color: "#141414", letterSpacing: -2 }}>
          Loans that work
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, color: BRAND, letterSpacing: -2 }}>
          around your payday.
        </div>
        <div style={{ marginTop: 28, fontSize: 32, lineHeight: 1.4, color: "#525252", maxWidth: 900 }}>
          Borrow cash or finance what you need. Repay in fixed monthly amounts taken straight from your salary.
        </div>
      </div>
      <div style={{ fontSize: 28, color: "#737373" }}>microbuiltprime.com</div>
    </div>,
    size
  );
}
