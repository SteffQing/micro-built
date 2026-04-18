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
import { uploadExistingCustomers } from "@/lib/mutations/admin/customers";
import { Icons } from "@/components/icons";
import { useUserProvider } from "@/store/auth";

export default function UploadExistingCustomers() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { userRole } = useUserProvider();

  function reset() {
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

  const { mutateAsync, isPending } = useMutation(uploadExistingCustomers);

  const handleUpload = async () => {
    if (!selectedFile) return;

    await mutateAsync(selectedFile);
    reset();
    setIsOpen(false);
  };

  const closeModal = () => {
    reset();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={userRole !== "SUPER_ADMIN"}>
          Upload Customers
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Existing Customers</DialogTitle>
        </DialogHeader>
        <Separator className="bg-border" />
        <section className="grid gap-4 sm:gap-5 p-4 sm:p-5">
          <p className="font-normal text-sm text-muted-foreground">
            Upload your customer data file to import existing customers into the
            system
          </p>

          <div className="flex gap-5 flex-col border border-border rounded-[8px] p-3">
            <Label
              className="text-foreground text-sm font-medium"
              htmlFor="customer-upload-input"
            >
              File{" "}
              <span className="text-muted-foreground font-normal text-xs">XLSX</span>
            </Label>

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              ref={fileInputRef}
              className="hidden"
              id="customer-upload-input"
            />

            {selectedFile ? (
              <Button
                className="max-h-12 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-2.5 rounded-[4px] gap-2 text-green-700 dark:text-green-400 text-xs font-normal disabled:opacity-100"
                disabled
              >
                <Icons.file className="mr-2 " />
                <span className="truncate max-w-[20ch]">
                  {selectedFile.name}
                </span>
                <span className="text-foreground">{`(${(
                  selectedFile.size / 1024
                ).toFixed(2)} KB)`}</span>
                <Icons.good_check />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="max-h-12 bg-muted border border-border p-2.5 rounded-[8px] gap-1 text-muted-foreground text-xs font-normal"
              >
                <Icons.upload className="mr-2" />
                Upload File
              </Button>
            )}
          </div>

          <Separator className="bg-border" />
        </section>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={closeModal}
            disabled={isPending}
            className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
          >
            Cancel
          </Button>
          <Button
            className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
            onClick={handleUpload}
            loading={isPending}
            disabled={!selectedFile || isPending}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
