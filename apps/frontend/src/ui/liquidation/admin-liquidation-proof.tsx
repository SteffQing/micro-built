"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Icon, icons } from "@/components/icon";
import { adminLiquidationProof } from "@/lib/queries/admin/customer";
import type { ReactNode } from "react";

type Props = {
  customerId: string;
  requestId: string;
  trigger?: ReactNode;
};

function isImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(jpe?g|png|webp|gif)$/.test(pathname);
  } catch {
    return false;
  }
}

export default function AdminLiquidationProof({
  customerId,
  requestId,
  trigger,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    ...adminLiquidationProof(customerId, requestId),
    enabled: isOpen,
  });

  const signedUrl = data?.data?.url ?? null;
  const isImage = signedUrl ? isImageUrl(signedUrl) : false;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="text-xs">
            <Icon icon={icons.view} size={12} className="mr-1" />
            View Proof
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[550px] rounded-lg">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-full">
              <Icon icon={icons.file} size={20} className="text-muted-foreground" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              Liquidation Proof
            </DialogTitle>
          </div>
        </DialogHeader>

        <Separator className="bg-border" />

        <section className="p-4 sm:p-5">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Icon
                icon={icons.loaderCircle}
                size={20}
                className="mr-2 animate-spin"
              />
              Loading proof…
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 p-4">
              <p className="text-sm text-destructive">
                Failed to load proof. Please try again.
              </p>
            </div>
          )}

          {signedUrl && isImage && (
            <div className="rounded-lg border border-border overflow-hidden">
              <img
                src={signedUrl}
                alt="Liquidation proof"
                className="w-full object-contain max-h-[60vh]"
              />
            </div>
          )}

          {signedUrl && !isImage && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <Icon icon={icons.file} size={28} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                This proof is a PDF document.
              </p>
              <Button
                variant="outline"
                onClick={() => window.open(signedUrl, "_blank")}
                className="btn-gradient"
              >
                <Icon icon={icons.download} size={16} className="mr-2" />
                Download Proof
              </Button>
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
