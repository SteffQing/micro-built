import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit2, Camera } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { updateAvatar } from "@/lib/mutations/user";
import { toast } from "sonner";
import { AVATAR_HOST } from "@/config/constants";
import { cn } from "@/lib/utils";

interface Props {
  id?: string;
  name?: string;
}

export const UserAvatar = ({ id, name }: Props) => {
  const { mutateAsync, isPending } = useMutation(updateAvatar);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    await mutateAsync(file);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCancel = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleEditClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative my-6">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

      <UserAvatarComponent id={id} name={name} previewUrl={previewUrl} />

      {!previewUrl ? (
        <button
          onClick={handleEditClick}
          className="absolute -bottom-1 -right-1 bg-background p-0.5 flex items-center justify-center rounded-full border border-border hover:bg-accent transition-colors"
          disabled={isPending}
        >
          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors">
            <Edit2 className="w-3 h-3 text-white" />
          </div>
        </button>
      ) : (
        <>
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2">
            <Button size="sm" onClick={handleUpload} loading={isPending} className="h-6 px-2 text-xs">
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
              className="h-6 px-2 text-xs"
            >
              Cancel
            </Button>
          </div>
          <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
        </>
      )}
    </div>
  );
};

interface UAC_Props extends Props {
  previewUrl?: string | null;
  className?: string;
}
export default function UserAvatarComponent({ id, name, previewUrl, className }: UAC_Props) {
  const getInitials = () => {
    if (!name)
      return id
        ? id
            .split("-")
            .map((word) => word.charAt(0))
            .join("")
            .slice(0, 2)
        : "MB";
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };
  return (
    <Avatar className={cn("w-16 h-16", className)}>
      <AvatarImage src={previewUrl || AVATAR_HOST + id} />
      <AvatarFallback className="bg-primary text-white font-semibold">{getInitials()}</AvatarFallback>
    </Avatar>
  );
}
