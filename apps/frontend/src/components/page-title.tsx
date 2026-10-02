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
}

export default function PageTitle({ title, downloadReport, actionContent }: Props) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4 lg:px-5 lg:py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {downloadReport && (
          <Button
            className="flex w-full gap-1 border border-destructive/20 px-3 rounded-xl text-sm text-brand font-normal bg-transparent hover:bg-transparent p-3 h-fit sm:w-auto"
            onClick={downloadReport.action}
            loading={downloadReport.loading}
          >
            Download Report <IconsAcrossPages.download />{" "}
          </Button>
        )}
        {actionContent && <div className="min-w-0 w-full sm:w-auto">{actionContent}</div>}
      </div>
    </div>
  );
}
