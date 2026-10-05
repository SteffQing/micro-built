import type { ReactNode } from "react";

/** One System Controls row: what it is on the left, its control on the right (stacks on narrow screens). */
export function SettingRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  const Title = htmlFor ? "label" : "p";
  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between lg:p-5">
      <div className="min-w-0 space-y-0.5">
        <Title htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {title}
        </Title>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
