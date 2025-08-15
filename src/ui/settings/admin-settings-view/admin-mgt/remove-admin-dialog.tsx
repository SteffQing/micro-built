import { removeAdmin } from "@/lib/mutations/admin/superadmin";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export default function RemoveAdmin({ id, name }: { id: string; name: string }) {
  const [isOpen, setisOpen] = useState(false);
  const handleOpen = (val: boolean) => {
    setisOpen(val);
  };
  const handleCloseMainModal = () => {
    handleOpen(false);
  };

  const { mutateAsync, isPending } = useMutation(removeAdmin);

  async function handleRemoval() {
    await mutateAsync({ id });
    handleCloseMainModal();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="group hover:bg-red-50 hover:border-red-200 transition-colors" size="sm">
          <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-red-600 transition-colors" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>Remove Admin</DialogTitle>
        </DialogHeader>

        <Separator className="bg-[#F0F0F0]" />
        <DialogDescription className="grid gap-4 p-4 sm:p-5">
          Are you sure to revoke admin access to {name}
        </DialogDescription>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCloseMainModal}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
            disabled={isPending}
          >
            No, Cancel
          </Button>
          <Button
            className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
            onClick={handleRemoval}
            loading={isPending}
          >
            Yes, Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
