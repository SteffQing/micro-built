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
      <div className="flex justify-between gap-2 items-center">
        <h2 className=" text-lg font-semibold">{title}</h2>
        {downloadReport && (
          <Button
            className="flex gap-1 border border-[#FFCDCC] px-3 rounded-xl text-sm text-[#8A0806] font-normal bg-transparent hover:bg-transparent p-3 h-fit"
            onClick={downloadReport.action}
            loading={downloadReport.loading}
          >
            Download Report <IconsAcrossPages.download />{" "}
          </Button>
        )}
        {actionContent}
      </div>
    </div>
  );
}
