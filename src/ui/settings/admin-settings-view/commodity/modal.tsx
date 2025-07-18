"use client";

import type React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface AddCommodityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
}

export default function AddCommodityModal({
  isOpen,
  onClose,
  onAdd,
}: AddCommodityModalProps) {
  const [commodityName, setCommodityName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commodityName.trim()) {
      onAdd(commodityName.trim());
      setCommodityName("");
      onClose();
    }
  };

  const handleClose = () => {
    setCommodityName("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Commodity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="commodity-name">Commodity Name</Label>
              <Input
                id="commodity-name"
                placeholder="Enter commodity name"
                value={commodityName}
                onChange={(e) => setCommodityName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!commodityName.trim()}>
              Add Commodity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
