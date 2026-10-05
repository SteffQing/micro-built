import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { UserAvatar } from "@/components/user-avatar";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { updateImage } from "@/lib/mutations/user";
import { toast } from "sonner";

interface Props {
  id?: string;
  name?: string;
  image?: string | null;
}

export const AvatarUploader = ({ id, name, image }: Props) => {
  const { mutateAsync, isPending } = useMutation(updateImage);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Matches the API's limit (POST /user/avatar rejects anything over 3 MB)
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image must be 3 MB or smaller");
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
    <div className="flex shrink-0 items-center gap-3">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

      <div className="relative">
        <UserAvatar id={id} name={name} image={previewUrl ?? image} size={64} />
        {!previewUrl && (
          <button
            type="button"
            onClick={handleEditClick}
            disabled={isPending}
            aria-label="Change profile photo"
            className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Icon icon={icons.camera} size={14} />
          </button>
        )}
      </div>

      {previewUrl && (
        <div className="flex flex-col gap-1.5">
          <Button size="sm" onClick={handleUpload} loading={isPending} className="h-7 px-3 text-xs">
            Save photo
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={isPending} className="h-7 px-3 text-xs">
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};
