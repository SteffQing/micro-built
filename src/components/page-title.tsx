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
    <div className="rounded border  p-3 lg:p-5 bg-background">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className=" text-lg font-semibold">{title}</h2>
        {downloadReport && (
          <Button
            className="flex w-full gap-1 border border-[#FFCDCC] px-3 rounded-xl text-sm text-[#8A0806] font-normal bg-transparent hover:bg-transparent p-3 h-fit sm:w-auto"
            onClick={downloadReport.action}
            loading={downloadReport.loading}
          >
            Download Report <IconsAcrossPages.download />{" "}
          </Button>
        )}
        <div className="w-full sm:w-auto">{actionContent}</div>
      </div>
    </div>
  );
}
