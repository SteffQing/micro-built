import { useUser, useUserMutation } from "@/hooks/api/use-user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit2, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

export const UserAvatar = () => {
  const { user } = useUser({});
  const { avatar, isLoading, isError, userName } = user;
  console.log({ user });
  const { uploadAvatar } = useUserMutation();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get initials for fallback
  const getInitials = (name: string) => {
    if (!name) return "MB";
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadAvatar.mutateAsync(file);
      setPreviewUrl(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Avatar Display */}
      {isLoading ? (
        <div className="w-16 h-16">
          <Skeleton className="w-16 h-16 rounded-full" />
        </div>
      ) : (
        !isLoading &&
        !isError && (
          <Avatar className="w-16 h-16">
            <AvatarImage src={previewUrl || avatar} />
            <AvatarFallback className="bg-primary text-white font-semibold">
              {getInitials(userName || "")}
            </AvatarFallback>
          </Avatar>
        )
      )}

      {/* Edit Button */}
      {!previewUrl && (
        <button
          onClick={handleEditClick}
          className="absolute -bottom-1 -right-1 bg-background p-0.5 flex items-center justify-center rounded-full border border-border hover:bg-accent transition-colors"
          disabled={isLoading}
        >
          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors">
            <Edit2 className="w-3 h-3 text-white" />
          </div>
        </button>
      )}

      {/* Preview Controls */}
      {previewUrl && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2">
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={isUploading}
            className="h-6 px-2 text-xs"
          >
            {isUploading ? "Uploading..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isUploading}
            className="h-6 px-2 text-xs"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Upload indicator overlay */}
      {previewUrl && (
        <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center">
          <Camera className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
};
