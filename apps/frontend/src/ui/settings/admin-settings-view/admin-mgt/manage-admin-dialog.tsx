"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  dialogBodyClass,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { changeAdminRole, removeAdmin } from "@/lib/mutations/admin/superadmin";
import { cn } from "@/lib/utils";
import { useUserProvider } from "@/store/auth";
import { ResetSignInForm } from "@/ui/reset-sign-in";

type AdminRole = Exclude<UserRole, "CUSTOMER">;

export const ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  MARKETER: "Marketer",
};

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t py-4 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** One admin's role, sign-in reset and access, in place of the old trash icon. Every change is audited. */
export function ManageAdminDialog({ admin }: { admin: AdminListDto }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AdminRole>(admin.role as AdminRole);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { user } = useUserProvider();
  const changeRole = useMutation(changeAdminRole);
  const remove = useMutation(removeAdmin);

  const isSelf = user?.id === admin.id;
  const removed = admin.status === "INACTIVE";
  const factors = [
    admin.twoFactorEnabled ? "2FA on" : "2FA off",
    `${admin.passkeys} passkey${admin.passkeys === 1 ? "" : "s"}`,
  ].join(" · ");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setRole(admin.role as AdminRole);
      setConfirmRemove(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Icon icon={icons.settings} size={14} />
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="grid-cols-1 gap-0 sm:max-w-md">
        <DialogHeader className="border-b">
          <div className="flex items-center gap-3">
            <UserAvatar id={admin.id} name={admin.name} size={40} />
            <div className="min-w-0 text-left">
              <DialogTitle className="truncate">{admin.name}</DialogTitle>
              <DialogDescription className="truncate">
                {ROLE_LABEL[admin.role as AdminRole] ?? admin.role} · {admin.email}
              </DialogDescription>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon icon={icons.shield} size={14} />
            {factors}
          </p>
        </DialogHeader>

        <div className={cn(dialogBodyClass, "gap-0 pt-4")}>
          {isSelf ? (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              This is you. Another super admin changes your role or resets your sign-in.
            </p>
          ) : removed ? (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              {admin.name} has been removed. Invite them again with Add admin to bring them back.
            </p>
          ) : (
            <>
              <Section title="Role" description="What they can see and do. Super admins need 2FA or a passkey.">
                <div className="flex gap-2">
                  <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
                    <SelectTrigger className="flex-1" aria-label="Role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABEL) as AdminRole[]).map((value) => (
                        <SelectItem key={value} value={value}>
                          {ROLE_LABEL[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={role === admin.role}
                    loading={changeRole.isPending}
                    onClick={() => changeRole.mutate({ id: admin.id, role }, { onSuccess: () => setOpen(false) })}
                  >
                    Save
                  </Button>
                </div>
              </Section>

              <Section
                title="Reset sign-in"
                description="For an admin locked out: lost phone, authenticator or security key."
              >
                <ResetSignInForm id={admin.id} name={admin.name} onDone={() => setOpen(false)} />
              </Section>

              <Section title="Remove access" description="They are signed out everywhere; their history stays.">
                {confirmRemove ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <span className="text-sm">Remove {admin.name}?</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setConfirmRemove(false)} disabled={remove.isPending}>
                        Keep
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        loading={remove.isPending}
                        onClick={() => remove.mutate({ id: admin.id }, { onSuccess: () => setOpen(false) })}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="justify-self-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmRemove(true)}
                  >
                    <Icon icon={icons.delete} size={14} />
                    Remove {admin.name}
                  </Button>
                )}
              </Section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
