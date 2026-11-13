"use client";

import { CheckIcon, CopyIcon, MailPlusIcon, UserMinusIcon } from "lucide-react";
import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/features/auth/components/form-field";
import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";

import {
  changeMemberRole,
  inviteMember,
  removeMember,
  revokeInvitation,
  type InviteState,
} from "../team-actions";
import {
  hasRole,
  roleLabels,
  type BusinessRole,
  type BusinessTeam,
} from "../types";
import { SelectField } from "./fields";

const dateFormat = new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium" });

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-2 rounded-md border bg-muted/40 p-3">
      <p className="text-sm font-medium">Линк за покана (важи 7 дни)</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">
          {url}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? (
            <CheckIcon aria-hidden="true" />
          ) : (
            <CopyIcon aria-hidden="true" />
          )}
          {copied ? "Копирано" : "Копирай"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Изпрати го лично на човека. Той трябва да влезе с поканения имейл, за да
        приеме.
      </p>
    </div>
  );
}

function InviteForm({
  businessId,
  myRole,
  full,
}: {
  businessId: string;
  myRole: BusinessRole;
  full: boolean;
}) {
  const [state, action] = useActionState<InviteState, FormData>(
    inviteMember.bind(null, businessId),
    initialFormState,
  );
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const errors = state.fieldErrors ?? {};
  // Managers may invite staff only; owners may also invite managers.
  const roles: BusinessRole[] =
    myRole === "owner" ? ["staff", "manager"] : ["staff"];

  return (
    <form
      action={action}
      noValidate
      className="grid gap-4 rounded-lg border bg-card p-5 shadow-card"
    >
      <h3 className="font-semibold">Покани човек в екипа</h3>
      <FormMessage state={state} />
      {state.status === "success" && state.inviteUrl && (
        <CopyLink url={state.inviteUrl} />
      )}
      {full && (
        <p className="text-sm text-muted-foreground">
          Достигнат е лимитът на членове за твоя план. Отмени покана или
          премахни член, за да поканиш нов.
        </p>
      )}
      <fieldset
        disabled={full}
        className="grid gap-4 disabled:opacity-60 sm:grid-cols-[1fr_12rem]"
      >
        <FormField
          name="email"
          type="email"
          label="Имейл"
          required
          autoComplete="off"
          defaultValue={values.email}
          errors={errors.email}
        />
        <SelectField
          name="role"
          label="Роля"
          defaultValue={values.role ?? "staff"}
          errors={errors.role}
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </SelectField>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        Мениджърът може да редактира профила, снимките, услугите и работното
        време. Служителят само вижда таблото.
      </p>
      {!full && (
        <SubmitButton pendingLabel="Изпращане…" className="w-fit">
          <MailPlusIcon aria-hidden="true" />
          Изпрати покана
        </SubmitButton>
      )}
    </form>
  );
}

function MemberRow({
  businessId,
  member,
  myRole,
}: {
  businessId: string;
  member: BusinessTeam["members"][number];
  myRole: BusinessRole;
}) {
  const [roleState, changeRole] = useActionState(
    changeMemberRole.bind(null, businessId, member.user_id),
    initialFormState,
  );
  const [removeState, remove] = useActionState(
    removeMember.bind(null, businessId, member.user_id),
    initialFormState,
  );
  const canManage = myRole === "owner" && member.role !== "owner";
  const canLeave = member.is_self && member.role !== "owner";

  return (
    <li className="grid gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {member.full_name || member.email || "Член на екипа"}
            {member.is_self && (
              <span className="text-muted-foreground"> (ти)</span>
            )}
          </p>
          {member.email && member.full_name && (
            <p className="truncate text-sm text-muted-foreground">
              {member.email}
            </p>
          )}
        </div>
        {canManage ? (
          <form action={changeRole} className="flex items-center gap-2">
            <label htmlFor={`role-${member.user_id}`} className="sr-only">
              Роля
            </label>
            <select
              // Remount on server changes: React resets forms after an action.
              key={member.role}
              id={`role-${member.user_id}`}
              name="role"
              defaultValue={member.role}
              className="h-9 rounded-md border bg-card px-2 text-sm"
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            >
              <option value="staff">{roleLabels.staff}</option>
              <option value="manager">{roleLabels.manager}</option>
            </select>
          </form>
        ) : (
          <Badge variant="secondary">{roleLabels[member.role]}</Badge>
        )}
        {(canManage || canLeave) && (
          <form
            action={remove}
            onSubmit={(event) => {
              const question = member.is_self
                ? "Да напуснеш ли екипа на този бизнес?"
                : "Да премахнем ли този човек от екипа?";
              if (!window.confirm(question)) event.preventDefault();
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              <UserMinusIcon aria-hidden="true" />
              {member.is_self ? "Напусни" : "Премахни"}
            </Button>
          </form>
        )}
      </div>
      <FormMessage state={roleState} />
      {removeState.status === "error" && <FormMessage state={removeState} />}
    </li>
  );
}

function InvitationRow({
  businessId,
  invitation,
}: {
  businessId: string;
  invitation: BusinessTeam["invitations"][number];
}) {
  const [state, revoke] = useActionState(
    revokeInvitation.bind(null, businessId, invitation.id),
    initialFormState,
  );
  return (
    <li className="grid gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{invitation.email}</p>
          <p className="text-sm text-muted-foreground">
            {roleLabels[invitation.role]} ·{" "}
            {invitation.is_expired
              ? "изтекла"
              : `валидна до ${dateFormat.format(new Date(invitation.expires_at))}`}
          </p>
        </div>
        <form action={revoke}>
          <SubmitButton
            pendingLabel="Отменяне…"
            variant="ghost"
            className="w-fit"
          >
            Отмени
          </SubmitButton>
        </form>
      </div>
      {state.status === "error" && <FormMessage state={state} />}
    </li>
  );
}

export function TeamManager({
  businessId,
  team,
  myRole,
  maxMembers,
}: {
  businessId: string;
  team: BusinessTeam;
  myRole: BusinessRole;
  maxMembers: number | null;
}) {
  const canInvite = hasRole(myRole, "manager");
  const used =
    team.members.length + team.invitations.filter((i) => !i.is_expired).length;
  const full = maxMembers !== null && used >= maxMembers;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-lg border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Членове</h3>
          {maxMembers !== null && canInvite && (
            <p className="text-sm text-muted-foreground">
              {used} от {maxMembers} места по плана (с чакащите покани)
            </p>
          )}
        </div>
        <ul className="divide-y">
          {team.members.map((member) => (
            <MemberRow
              key={member.user_id}
              businessId={businessId}
              member={member}
              myRole={myRole}
            />
          ))}
        </ul>
      </section>

      {canInvite && team.invitations.length > 0 && (
        <section className="grid gap-4 rounded-lg border bg-card p-5 shadow-card">
          <h3 className="font-semibold">Чакащи покани</h3>
          <ul className="divide-y">
            {team.invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                businessId={businessId}
                invitation={invitation}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Kept mounted when the limit is reached so the link of the
          invitation that filled the last place stays visible. */}
      {canInvite && (
        <InviteForm businessId={businessId} myRole={myRole} full={full} />
      )}
    </div>
  );
}
