import { IconsAcrossPages } from "./svg";
import { Button } from "./ui/button";

interface Props {
  title: string;
  downloadReport?: {
    action: () => void;
    loading: boolean;
  };
}

export default function PageTitle({ title, downloadReport }: Props) {
  return (
    <div className="rounded-[12px] border border-[#F0F0F0] p-3 lg:p-5">
      <div className="flex justify-between gap-2">
        <h2 className="text-black text-lg font-semibold">{title}</h2>
        {downloadReport && (
          <Button
            className="flex gap-1 border border-[#FFCDCC] px-3 rounded-xl text-sm text-[#8A0806] font-normal"
            onClick={downloadReport.action}
            loading={downloadReport.loading}
          >
            Download Report <IconsAcrossPages.download />{" "}
          </Button>
        )}
      </div>
    </div>
  );
}
