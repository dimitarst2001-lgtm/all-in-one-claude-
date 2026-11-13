import type { Metadata } from "next";
import Link from "next/link";
import { UsersIcon } from "lucide-react";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/features/auth/session";
import { AcceptInvitationForm } from "@/features/dashboard/components/accept-invitation-form";
import { getInvitationPreview } from "@/features/dashboard/queries";
import { roleLabels } from "@/features/dashboard/types";

export const metadata: Metadata = {
  title: "Покана за екип",
  robots: { index: false, follow: false },
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-lg rounded-lg border bg-card p-6 shadow-card md:p-8">
      <span className="mb-4 flex size-11 items-center justify-center rounded-md bg-accent text-primary">
        <UsersIcon className="size-5" aria-hidden="true" />
      </span>
      {children}
    </div>
  );
}

async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireUser(`/invitations/${token}`);
  const invitation = await getInvitationPreview(token);

  if (!invitation) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Поканата не е намерена</h1>
        <p className="mt-2 text-muted-foreground">
          Линкът е непълен или поканата е изтрита. Помоли за нова покана.
        </p>
      </Card>
    );
  }

  if (invitation.status !== "open") {
    const text = {
      accepted: "Тази покана вече е приета.",
      revoked: "Тази покана е отменена.",
      expired: "Тази покана е изтекла. Помоли за нова покана.",
    }[invitation.status];
    return (
      <Card>
        <h1 className="text-xl font-semibold">{invitation.business_name}</h1>
        <p className="mt-2 text-muted-foreground">{text}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/dashboard">Към таблото</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">
        Покана за екипа на {invitation.business_name}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Поканен си като{" "}
        <strong className="text-foreground">
          {roleLabels[invitation.role].toLowerCase()}
        </strong>{" "}
        на адрес {invitation.email}.
      </p>
      {invitation.email_matches ? (
        <AcceptInvitationForm token={token} />
      ) : (
        <p className="mt-6 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
          В момента си влязъл като {user.email}. Излез и влез с{" "}
          {invitation.email}, за да приемеш поканата.
        </p>
      )}
    </Card>
  );
}

export default function InvitationPage({
  params,
}: PageProps<"/invitations/[token]">) {
  return (
    <div className="container-page py-10 md:py-14">
      <Suspense fallback={<Skeleton className="h-64 max-w-lg" />}>
        <Invitation params={params} />
      </Suspense>
    </div>
  );
}
