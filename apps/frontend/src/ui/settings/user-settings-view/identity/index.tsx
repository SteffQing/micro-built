import { userIdentity } from "@/lib/queries/user";
import { useQuery } from "@tanstack/react-query";
import { UserIdentitySkeleton } from "./components";
import UserIdentitySection from "./display";

export default function UserIdentity() {
  const { data, isLoading } = useQuery(userIdentity);
  const identity = data?.data;

  return isLoading ? (
    <UserIdentitySkeleton />
  ) : identity ? (
    <UserIdentitySection key={JSON.stringify(identity)} {...identity} />
  ) : (
    <UserIdentitySection isNew />
  );
}
