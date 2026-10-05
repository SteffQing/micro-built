import { Icon, icons } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { visibleEmail } from "@microbuilt/shared";
import { PHONE_AUTH_ENABLED } from "@/config/features";
import { ContactChangeDialog, NameField, ProfileField } from "./profile-edit";
import { AvatarUploader } from "./avatar-uploader";
import { getUser } from "@/lib/queries/user";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { capitalize } from "@/lib/utils";
import { PendingChangeNotice } from "@/ui/change-requests/pending-change-notice";

export function ProfileInformation() {
  const { data, isLoading } = useQuery(getUser);
  const user = data?.data;
  // A super admin's own edits apply at once; everyone else's become a change request an admin approves.
  const applied = user?.role === "SUPER_ADMIN";

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
          {isLoading || !user ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border px-4 py-4 sm:px-5">
              <NameField name={user.name} applied={applied} />
              <ProfileField
                icon={icons.mail}
                label="Email address"
                value={visibleEmail(user.email) ?? <span className="text-muted-foreground">Not added</span>}
                action={<ContactChangeDialog channel="email" current={user.email} applied={applied} />}
              />
              <ProfileField
                icon={icons.phone}
                label="Phone number"
                value={user.phoneNumber ?? <span className="text-muted-foreground">Not added</span>}
                action={
                  PHONE_AUTH_ENABLED ? (
                    <ContactChangeDialog channel="phone" current={user.phoneNumber} applied={applied} />
                  ) : undefined
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
