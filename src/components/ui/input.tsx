import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/75 selection:bg-primary selection:text-primary-foreground flex h-10 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-base text-foreground shadow-xs transition-[border-color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 md:text-sm",
        "hover:border-muted-foreground/35",
        "focus-visible:border-foreground/40 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-foreground/10",
        "dark:border-border dark:bg-background dark:hover:border-muted-foreground/45 dark:focus-visible:border-foreground/50 dark:focus-visible:ring-foreground/15",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
