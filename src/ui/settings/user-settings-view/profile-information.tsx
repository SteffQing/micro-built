import Image from "next/image";
import { CheckCheckIcon, Edit2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/hooks/api/use-user";

export function ProfileInformation() {
  const {
    user,
    userId,
    userRole,
    userStatus,
    userName,
    userEmail,
    avatar,
    isAdmin,
    isCustomer,

    isLoading,

    isError,

    error,
  } = useUser();
  return (
    <div className="max-w-4xl">
      <div className=" p-3">
        <h2 className="text-lg font-semibold mb-6">Profile Information</h2>

        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative">
            <Avatar>
              <AvatarImage src={avatar} />
              <AvatarFallback>MB</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <Edit2 className="w-3 h-3 text-white" />
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
                    userStatus === "ACTIVE" ? "bg-green-100 text-green-700" : ""
                  }`}
                >
                  <div className=" bg-green-500 rounded-full mr-1 p-1">
                    <CheckCheckIcon className="w-2 h-2 text-white" />
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
                  defaultValue="Jadesola"
                  className="pr-10"
                />
                <Edit2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <div className="relative">
                <Input id="lastName" defaultValue="Cole" className="pr-10" />
                <Edit2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                defaultValue="Jadecole@gmail.com"
                readOnly
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
