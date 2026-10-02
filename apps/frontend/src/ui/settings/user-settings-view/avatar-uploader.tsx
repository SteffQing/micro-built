import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { UserAvatar } from "@/components/user-avatar";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { updateAvatar } from "@/lib/mutations/user";
import { toast } from "sonner";

interface Props {
  id?: string;
  name?: string;
  image?: string | null;
}

export const AvatarUploader = ({ id, name, image }: Props) => {
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

      <UserAvatar id={id} name={name} image={previewUrl ?? image} size={64} />

      {!previewUrl ? (
        <button
          onClick={handleEditClick}
          className="absolute -bottom-1 -right-1 bg-background p-0.5 flex items-center justify-center rounded-full border border-border hover:bg-accent transition-colors"
          disabled={isPending}
        >
          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors">
            <Icon icon={icons.edit} size={12} className="text-primary-foreground" />
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
            <Icon icon={icons.camera} size={16} className="text-primary-foreground" />
          </div>
        </>
      )}
    </div>
  );
};
