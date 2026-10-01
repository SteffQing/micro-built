import { withSentryConfig } from "@sentry/nextjs/config";
import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hlvusfvooxvhazayudnt.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // This app lives inside a pnpm workspace: pin file tracing and the turbopack
  // root to the monorepo root so Vercel bundles packages/shared (and, from
  // Stage 4, the backend's published auth client).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});