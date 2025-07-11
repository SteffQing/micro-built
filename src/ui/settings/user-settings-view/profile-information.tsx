import { CheckCheckIcon, Edit2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/hooks/api/use-user";

export function ProfileInformation() {
  const { user: _user } = useUser({});
  const { userId, userStatus, userName, userEmail, avatar } = _user;

  return (
    <div className="max-w-4xl">
      <div className=" p-3">
        <h2 className="text-lg font-semibold mb-6">Profile Information</h2>

        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative">
            <Avatar className="w-16 h-16">
              <AvatarImage src={avatar} />
              <AvatarFallback>MB</AvatarFallback>
            </Avatar>
            <div className="absolute  -bottom-1 -right-1 bg-background p-0.5 flex items-center justify-center">
              <div className=" w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <Edit2 className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold ">{userName}</h3>
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
                  defaultValue={userName}
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
                  defaultValue={userName}
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
                defaultValue={userEmail}
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
                  defaultValue="+234-8134568058"
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
