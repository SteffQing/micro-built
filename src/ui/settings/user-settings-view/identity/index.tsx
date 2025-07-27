import { userIdentity } from "@/lib/queries/user";
import { useQuery } from "@tanstack/react-query";
import { UserIdentitySkeleton, UserIdentityEmptyState } from "./components";
import UserIdentitySection from "./display";

export default function UserIdentity() {
  const { data, isLoading } = useQuery(userIdentity);
  const identity = data?.data;

  return isLoading ? (
    <UserIdentitySkeleton />
  ) : identity ? (
    <UserIdentitySection {...identity} />
  ) : (
    <UserIdentityEmptyState />
  );
}
