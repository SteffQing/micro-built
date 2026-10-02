import { RefObject } from "react";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { Button } from "./ui/button";
import { Label } from "./ui/label";

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
    <div className="flex gap-5 flex-col border border-border rounded-[8px] p-3">
      <Label
        className="text-muted-foreground text-sm font-medium"
        htmlFor="upload-input"
      >
        {label}{" "}
        <span className="text-muted-foreground font-normal text-xs">
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
          className="max-h-12 bg-success/10 border border-success/20 p-2.5 rounded-[4px] gap-2 text-success text-xs font-normal disabled:opacity-100"
          disabled
        >
          {isPending ? (
            <>
              <Icon icon={icons.loaderCircle} size={16} className="mr-2 animate-spin" />
              <span className="sr-only">Uploading…</span>
            </>
          ) : (
            <Icon icon={icons.file} size={16} className="mr-2" />
          )}
          {selectedFile.name}{" "}
          <span className="text-muted-foreground">{`(${(
            selectedFile.size / 1024
          ).toFixed(2)} KB)`}</span>
          {!isPending && <Icon icon={icons.checkCircle} size={16} />}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={!isPending ? () => fileInputRef.current?.click() : undefined}
          className="max-h-12 bg-muted border border-border p-2.5 rounded-[8px] gap-1 text-muted-foreground text-xs font-normal"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Icon icon={icons.loaderCircle} size={16} className="mr-2 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Icon icon={icons.upload} size={16} className="mr-2" />
              Upload File
            </>
          )}
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
