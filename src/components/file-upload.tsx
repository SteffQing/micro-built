import { RefObject } from "react";
import { Icons } from "./icons";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Loader2 } from "lucide-react";

interface Props {
  selectedFile: File | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string | null;
  label: string;
  fileTypesLabel: string[];
  accept: HTMLInputElement["accept"];
  isPending?: boolean;
}
export default function FileUpload({
  selectedFile,
  fileInputRef,
  handleFileSelect,
  error,
  label,
  fileTypesLabel,
  accept,
  isPending,
}: Props) {
  return (
    <div className="flex gap-5 flex-col border border-[#F0F0F0] rounded-[8px] p-3">
      <Label
        className="text-[#666666] text-sm font-medium"
        htmlFor="upload-input"
      >
        {label}{" "}
        <span className="text-[#999999] font-normal text-xs">
          {fileTypesLabel.map((type) => type).join(", ")}
        </span>
      </Label>

      <input
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        ref={fileInputRef}
        className="hidden"
        id="upload-input"
      />

      {selectedFile ? (
        <Button
          className="max-h-12 bg-[#F0FFF0] border border-[#D1FFD3] p-2.5 rounded-[4px] gap-2 text-[#046307] text-xs font-normal disabled:opacity-100"
          disabled
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="sr-only">Uploading…</span>
            </>
          ) : (
            <Icons.file className="mr-2" />
          )}
          {selectedFile.name}{" "}
          <span className="text-[#666666]">{`(${(
            selectedFile.size / 1024
          ).toFixed(2)} KB)`}</span>
          {!isPending && <Icons.good_check />}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={!isPending ? () => fileInputRef.current?.click() : undefined}
          className="max-h-12 bg-[#FAFAFA] border border-[#F0F0F0] p-2.5 rounded-[8px] gap-1 text-[#999999] text-xs font-normal"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Icons.upload className="mr-2" />
              Upload File
            </>
          )}
        </Button>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
