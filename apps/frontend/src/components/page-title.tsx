import { ReactNode } from "react";
import { IconsAcrossPages } from "./svg";
import { Button } from "./ui/button";

interface Props {
  title: string;
  downloadReport?: {
    action: () => void;
    loading: boolean;
  };
  actionContent?: ReactNode;
  /** A compact control that stays on the title's line, even on phones (e.g. a period picker). */
  titleAside?: ReactNode;
}

export default function PageTitle({ title, downloadReport, actionContent, titleAside }: Props) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4 lg:px-5 lg:py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {titleAside && <div className="ml-auto flex min-w-0 items-center">{titleAside}</div>}
        {downloadReport && (
          <Button
            className="flex w-full gap-1 border border-destructive/20 px-3 rounded-xl text-sm text-brand font-normal bg-transparent hover:bg-transparent p-3 h-fit sm:w-auto"
            onClick={downloadReport.action}
            loading={downloadReport.loading}
          >
            Download Report <IconsAcrossPages.download />{" "}
          </Button>
        )}
        {/* Beside the title on phones too; it only wraps below when the row runs out of room. */}
        {actionContent && <div className="ml-auto min-w-0 max-w-full">{actionContent}</div>}
      </div>
    </div>
  );
}
