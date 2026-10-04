import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SettingsSecurityPage({ searchParams }: Props) {
  const params = await searchParams;
  const setup = typeof params.setup === "string" ? params.setup : "";
  const target = setup
    ? `/settings?view=authentication&setup=${setup}`
    : `/settings?view=security`;
  redirect(target);
}
