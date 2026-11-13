"use server";

import { z } from "zod";

import type { FormState } from "@/features/auth/form-state";

import {
  authed,
  fail,
  invalidatePublic,
  NOT_SIGNED_IN,
} from "./action-helpers";
import { mediaKindSchema } from "./types";

/**
 * Photo actions. The file itself is uploaded by the browser to Supabase
 * Storage (bucket policies allow managers only); these actions register,
 * reorder and retire the database rows and remove files that are no longer
 * referenced.
 */

const BUCKET = "business-media";

const registerSchema = z.object({
  businessId: z.uuid(),
  path: z.string().max(200),
  kind: mediaKindSchema,
  width: z.number().int().positive().max(20000).nullable(),
  height: z.number().int().positive().max(20000).nullable(),
});

export async function registerMedia(input: {
  businessId: string;
  path: string;
  kind: string;
  width: number | null;
  height: number | null;
}): Promise<FormState> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return NOT_SIGNED_IN;
  const { businessId, path, kind, width, height } = parsed.data;

  return authed(async (supabase) => {
    const { data, error } = await supabase.rpc("register_business_media", {
      p_business_id: businessId,
      p_path: path,
      p_kind: kind,
      p_width: width,
      p_height: height,
    });
    if (error) {
      // Do not leave an orphaned file behind when the row was refused.
      await supabase.storage.from(BUCKET).remove([path]);
      return fail(error);
    }
    const retired = z
      .object({ retired_paths: z.array(z.string()) })
      .parse(data).retired_paths;
    if (retired.length) await supabase.storage.from(BUCKET).remove(retired);
    await invalidatePublic(businessId);
    return { status: "success", message: "Снимката е добавена." };
  });
}

export async function removeMedia(
  businessId: string,
  mediaId: string,
  _prev: FormState,
): Promise<FormState> {
  if (
    !z.uuid().safeParse(businessId).success ||
    !z.uuid().safeParse(mediaId).success
  ) {
    return NOT_SIGNED_IN;
  }
  return authed(async (supabase) => {
    const { data, error } = await supabase
      .from("business_media")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", mediaId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .select("storage_path");
    if (error) return fail(error);
    if (!data?.length)
      return { status: "error", message: "Нямаш права за това действие." };
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove(data.map((row) => row.storage_path as string));
    if (storageError) console.error("[media] remove file", storageError);
    await invalidatePublic(businessId);
    return { status: "success", message: "Снимката е премахната." };
  });
}

export async function moveMedia(
  businessId: string,
  mediaId: string,
  direction: -1 | 1,
  _prev: FormState,
): Promise<FormState> {
  if (
    !z.uuid().safeParse(businessId).success ||
    !z.uuid().safeParse(mediaId).success ||
    (direction !== -1 && direction !== 1)
  ) {
    return NOT_SIGNED_IN;
  }
  return authed(async (supabase) => {
    const { error } = await supabase.rpc("move_business_media", {
      p_media_id: mediaId,
      p_direction: direction,
    });
    if (error) return fail(error);
    await invalidatePublic(businessId);
    return { status: "success", message: "Подредбата е запазена." };
  });
}
