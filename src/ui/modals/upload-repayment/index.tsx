import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { uploadRepayment } from "@/lib/mutations/admin/repayments";
import { Icons } from "@/components/icons";
import { Input } from "@/components/ui/input";

export default function UploadRepayment() {
  const [isOpen, setIsOpen] = useState(false);
  const [period, setPeriod] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setPeriod("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isXlsx =
      file.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.name.endsWith(".xlsx");

    if (!isXlsx) {
      toast.error("Please select a valid .xlsx file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setSelectedFile(file);
  };

  const { mutateAsync, isPending } = useMutation(uploadRepayment);

  const handleUpload = async () => {
    if (!selectedFile) return;

    const data = {
      file: selectedFile,
      period,
    };

    await mutateAsync(data);
    reset();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Upload Repayment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Repayment File</DialogTitle>
        </DialogHeader>
        <Separator className="bg-[#F0F0F0]" />
        <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
          <p className="font-normal text-sm text-[#999999]">
            Upload your repayment data file to automatically match payments to
            customer loans
          </p>

          <div className="flex gap-5 flex-col border border-[#F0F0F0] rounded-[8px] p-3">
            <Label
              className="text-[#666666] text-sm font-medium"
              htmlFor="repayment-upload-input"
            >
              File{" "}
              <span className="text-[#999999] font-normal text-xs">XLSX</span>
            </Label>

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              ref={fileInputRef}
              className="hidden"
              id="repayment-upload-input"
            />

            {selectedFile ? (
              <Button
                className="max-h-12 bg-[#F0FFF0] border border-[#D1FFD3] p-2.5 rounded-[4px] gap-2 text-[#046307] text-xs font-normal disabled:opacity-100"
                disabled
              >
                <Icons.file className="mr-2 " />
                {selectedFile.name}{" "}
                <span className="text-[#666666]">{`(${(
                  selectedFile.size / 1024
                ).toFixed(2)} KB)`}</span>
                <Icons.good_check />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="max-h-12 bg-[#FAFAFA] border border-[#F0F0F0] p-2.5 rounded-[8px] gap-1 text-[#999999] text-xs font-normal"
              >
                <Icons.upload className="mr-2" />
                Upload File
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Label className="text-sm font-medium">Repayment Period</Label>
            <Input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="APRIL 2025"
            />
          </div>

          <Separator className="bg-[#F0F0F0]" />
        </section>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={reset}
            disabled={isPending}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
          >
            Cancel
          </Button>
          <Button
            className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
            onClick={handleUpload}
            loading={isPending}
            disabled={!period || !selectedFile}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
