import { CheckCheckIcon, Edit2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/api/use-user";
import { UserAvatar } from "@/ui/settings/user-settings-view/user-avatar";

export function ProfileInformation() {
  const { user: _user, userIdentity } = useUser({ fetchUserIdentity: true });
  const { userId, userStatus, userName, userEmail } = _user;
  const {
    data,
    isLoading: identityLoading,
    isError: identityError,
  } = userIdentity;

  return (
    <div className="max-w-4xl">
      <div className=" p-3">
        <h2 className="text-lg font-semibold mb-6">Profile Information</h2>

        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-8">
          <UserAvatar />
          <div>
            {data?.firstName ? (
              <h3 className="text-xl font-semibold ">{data?.firstName}</h3>
            ) : null}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground">{userId}</span>
              {userStatus && (
                <Badge
                  variant="secondary"
                  className={` ${
                    userStatus === "ACTIVE"
                      ? "bg-green-200/70 text-green-500"
                      : ""
                  }`}
                >
                  <div className=" bg-green-500 rounded-full mr-1 p-1">
                    <CheckCheckIcon className="w-1 h-1 text-white" />
                  </div>
                  {userStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div>
          <h4 className="text-base font-medium mb-4">Personal Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="firstName">Name</Label>
              <div className="relative">
                <Input
                  id="firstName"
                  value={data?.firstName || "Add firstName"}
                  className="pr-10"
                  disabled
                />
                <Edit2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <div className="relative">
                <Input
                  id="lastName"
                  value={data?.lastName || "Add lastName"}
                  className="pr-10"
                  disabled
                />
                <Edit2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={userEmail}
                readOnly
                disabled
                className="bg-gray-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Input
                  id="phone"
                  value="Add phone number"
                  className="pr-10"
                  disabled
                />
                <Edit2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
