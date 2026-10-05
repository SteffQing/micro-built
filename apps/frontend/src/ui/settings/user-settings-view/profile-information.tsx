import { Icon, icons } from "@/components/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AvatarUploader } from "./avatar-uploader";
import { getUser } from "@/lib/queries/user";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { capitalize } from "@/lib/utils";
import { PendingChangeNotice } from "@/ui/change-requests/pending-change-notice";

export function ProfileInformation() {
  const { data, isLoading } = useQuery(getUser);
  const user = data?.data;

  return (
    <div className="max-w-4xl">
      <div className="p-4 lg:p-6">
        <div className="mb-6 space-y-1">
          <h2 className="text-lg font-semibold">Profile Information</h2>
          <p className="text-sm text-muted-foreground">Your photo and the details we hold for you.</p>
        </div>

        {user && user.role !== "SUPER_ADMIN" && (
          <div className="mb-6">
            <PendingChangeNotice kind="PROFILE" />
          </div>
        )}

        <div className="flex items-center gap-4 mb-8">
          {isLoading || !user ? (
            <Skeleton className="size-16 rounded-full" />
          ) : (
            <AvatarUploader id={user.id} name={user.name} image={user.image} />
          )}
          <div className="min-w-0">
            {isLoading ? <Skeleton className="h-6 w-40" /> : <h3 className="truncate text-xl font-semibold">{user?.name}</h3>}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="truncate text-sm text-muted-foreground">{user?.id}</span>
              {user && (
                <Badge
                  variant="secondary"
                  className={` ${user.status === "ACTIVE" ? "bg-success/10 text-success" : ""}`}
                >
                  <div className=" bg-success rounded-full mr-1 p-1">
                    <Icon icon={icons.checkCheck} size={4} className="text-success-foreground" />
                  </div>
                  {capitalize(user.status)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-base font-medium mb-4">Personal Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="firstName">Name</Label>
              <div className="relative">
                <Input id="firstName" value={user?.name ?? ""} readOnly disabled={user?.role === "CUSTOMER"} className="pr-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={user?.email ?? ""} readOnly
                disabled={user?.role === "CUSTOMER"}
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <div className="relative">
                <Input
                  id="phoneNumber"
                  className="pr-10"
                  disabled={user?.role === "CUSTOMER"}
                  value={user?.phoneNumber ?? ""} readOnly
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
