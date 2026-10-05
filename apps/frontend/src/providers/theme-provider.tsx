"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// next-themes renders an inline <script> that sets the theme class before paint. It only needs to run from the
// server HTML; on the client React 19 warns about any executable <script> it renders, so mark the client copy as
// inert JSON (it has already run by then).
const clientScriptProps = typeof window === "undefined" ? undefined : ({ type: "application/json" } as const)

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider scriptProps={clientScriptProps} {...props}>
      {children}
    </NextThemesProvider>
  )
}
