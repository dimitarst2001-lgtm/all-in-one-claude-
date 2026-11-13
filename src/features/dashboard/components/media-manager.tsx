"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import { useActionState, useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/features/auth/components/form-message";
import { initialFormState, type FormState } from "@/features/auth/form-state";
import { publicMediaUrl } from "@/features/marketplace/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import { moveMedia, registerMedia, removeMedia } from "../media-actions";
import type { DashboardMedia, MediaKind } from "../types";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_EDGE: Record<MediaKind, number> = {
  logo: 800,
  cover: 2400,
  gallery: 2000,
};

type Prepared = { blob: Blob; ext: string; width: number; height: number };

/**
 * Downscales large photos in the browser and re-encodes them as WebP, so
 * phone pictures upload quickly and fit the 5 MB bucket limit. Falls back to
 * the original file when the browser cannot decode or encode it.
 */
async function prepareImage(file: File, kind: MediaKind): Promise<Prepared> {
  const originalExt =
    file.type === "image/jpeg" ? "jpg" : file.type.replace("image/", "");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { blob: file, ext: originalExt, width: 0, height: 0 };
  }
  const scale = Math.min(
    1,
    MAX_EDGE[kind] / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  if (scale === 1 && file.size <= 1.5 * 1024 * 1024) {
    bitmap.close();
    return { blob: file, ext: originalExt, width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob || blob.type !== "image/webp") {
    return { blob: file, ext: originalExt, width, height };
  }
  return { blob, ext: "webp", width, height };
}

function UploadButton({
  businessId,
  kind,
  label,
  disabled,
}: {
  businessId: string;
  kind: MediaKind;
  label: string;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setState({
        status: "error",
        message: "Поддържани формати: JPG, PNG, WebP и AVIF.",
      });
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setState({
        status: "error",
        message: "Файлът е твърде голям (до 20 MB).",
      });
      return;
    }

    startTransition(async () => {
      setState(initialFormState);
      try {
        const prepared = await prepareImage(file, kind);
        if (prepared.blob.size > MAX_UPLOAD_BYTES) {
          setState({
            status: "error",
            message:
              "Снимката е над 5 MB дори след оптимизиране. Избери по-малка.",
          });
          return;
        }
        const path = `${businessId}/${crypto.randomUUID()}.${prepared.ext}`;
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.storage
          .from("business-media")
          .upload(path, prepared.blob, {
            contentType: prepared.blob.type || file.type,
            cacheControl: "31536000",
            upsert: false,
          });
        if (error) {
          console.error("[media] upload", error);
          setState({
            status: "error",
            message: "Качването не успя. Провери връзката и опитай отново.",
          });
          return;
        }
        setState(
          await registerMedia({
            businessId,
            path,
            kind,
            width: prepared.width || null,
            height: prepared.height || null,
          }),
        );
      } catch (error) {
        console.error("[media] upload", error);
        setState({
          status: "error",
          message: "Нещо се обърка. Опитай отново.",
        });
      }
    });
  }

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={onChange}
        disabled={disabled || pending}
        tabIndex={-1}
      />
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={disabled || pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? (
          <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
        ) : (
          <ImagePlusIcon aria-hidden="true" />
        )}
        {pending ? "Качване…" : label}
      </Button>
      <FormMessage state={state} />
    </div>
  );
}

function MediaTile({
  businessId,
  item,
  name,
  canEdit,
  first,
  last,
  sortable,
}: {
  businessId: string;
  item: DashboardMedia;
  name: string;
  canEdit: boolean;
  first?: boolean;
  last?: boolean;
  sortable?: boolean;
}) {
  const [removeState, remove, removing] = useActionState(
    removeMedia.bind(null, businessId, item.id),
    initialFormState,
  );
  const [, moveEarlier, movingEarlier] = useActionState(
    moveMedia.bind(null, businessId, item.id, -1),
    initialFormState,
  );
  const [, moveLater, movingLater] = useActionState(
    moveMedia.bind(null, businessId, item.id, 1),
    initialFormState,
  );
  const url = publicMediaUrl(item.storage_path);
  const busy = removing || movingEarlier || movingLater;

  return (
    <li className="grid gap-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md border bg-muted">
        {url && (
          <Image
            src={url}
            alt={item.alt_text ?? name}
            fill
            sizes="(min-width: 768px) 240px, 50vw"
            className="object-cover"
          />
        )}
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-1">
          {sortable && (
            <>
              <form action={moveEarlier}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  disabled={busy || first}
                  aria-label="Премести по-напред"
                >
                  <ArrowLeftIcon aria-hidden="true" />
                </Button>
              </form>
              <form action={moveLater}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  disabled={busy || last}
                  aria-label="Премести по-назад"
                >
                  <ArrowRightIcon aria-hidden="true" />
                </Button>
              </form>
            </>
          )}
          <form
            action={remove}
            className="ml-auto"
            onSubmit={(event) => {
              if (!window.confirm("Да премахнем ли снимката?")) {
                event.preventDefault();
              }
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              disabled={busy}
              className="text-destructive hover:text-destructive"
            >
              <Trash2Icon aria-hidden="true" />
              Премахни
            </Button>
          </form>
        </div>
      )}
      {removeState.status === "error" && <FormMessage state={removeState} />}
    </li>
  );
}

function SingleSlot({
  businessId,
  kind,
  title,
  description,
  item,
  name,
  canEdit,
}: {
  businessId: string;
  kind: "logo" | "cover";
  title: string;
  description: string;
  item: DashboardMedia | undefined;
  name: string;
  canEdit: boolean;
}) {
  return (
    <section className="grid gap-3 rounded-lg border bg-card p-5 shadow-card">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {item ? (
        <ul className={kind === "logo" ? "max-w-40" : "max-w-md"}>
          <MediaTile
            businessId={businessId}
            item={item}
            name={name}
            canEdit={canEdit}
          />
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Няма качена снимка.</p>
      )}
      {canEdit && (
        <UploadButton
          businessId={businessId}
          kind={kind}
          label={item ? "Смени" : "Качи"}
        />
      )}
    </section>
  );
}

export function MediaManager({
  businessId,
  businessName,
  media,
  maxImages,
  canEdit,
}: {
  businessId: string;
  businessName: string;
  media: DashboardMedia[];
  maxImages: number | null;
  canEdit: boolean;
}) {
  const logo = media.find((item) => item.kind === "logo");
  const cover = media.find((item) => item.kind === "cover");
  const gallery = media.filter((item) => item.kind === "gallery");
  // The plan limit counts cover and gallery photos (not the logo).
  const counted = media.filter((item) => item.kind !== "logo").length;
  const full = maxImages !== null && counted >= maxImages;

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <SingleSlot
          businessId={businessId}
          kind="logo"
          title="Лого"
          description="Квадратно изображение, показва се в резултатите от търсене."
          item={logo}
          name={businessName}
          canEdit={canEdit}
        />
        <SingleSlot
          businessId={businessId}
          kind="cover"
          title="Основна снимка"
          description="Широка снимка на обекта, показва се най-горе в профила."
          item={cover}
          name={businessName}
          canEdit={canEdit && (!full || Boolean(cover))}
        />
      </div>

      <section className="grid gap-4 rounded-lg border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-semibold">Галерия</h3>
            <p className="text-sm text-muted-foreground">
              Снимки на обекта, оборудването и работата ви. Първата се показва
              първа в профила.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {maxImages === null
              ? `${counted} снимки`
              : `${counted} от ${maxImages} снимки по плана`}
          </p>
        </div>
        {gallery.length > 0 ? (
          <ul
            aria-label="Снимки в галерията"
            className="grid grid-cols-2 gap-4 md:grid-cols-3"
          >
            {gallery.map((item, index) => (
              <MediaTile
                key={item.id}
                businessId={businessId}
                item={item}
                name={businessName}
                canEdit={canEdit}
                sortable
                first={index === 0}
                last={index === gallery.length - 1}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Все още няма снимки в галерията.
          </p>
        )}
        {canEdit &&
          (full ? (
            <p className="text-sm text-muted-foreground">
              Достигнат е лимитът на снимки за твоя план. Премахни снимка, за да
              добавиш нова.
            </p>
          ) : (
            <UploadButton
              businessId={businessId}
              kind="gallery"
              label="Добави снимка"
            />
          ))}
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP или AVIF. Големите снимки се оптимизират автоматично
          преди качване. Качвай само снимки, за които имаш права.
        </p>
      </section>
    </div>
  );
}
