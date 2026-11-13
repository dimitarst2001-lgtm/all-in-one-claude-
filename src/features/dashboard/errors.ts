import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Maps database errors raised by RLS, triggers and dashboard functions to
 * user-facing Bulgarian messages. Unknown errors get a generic message; the
 * original is logged on the server only.
 */
export function dashboardErrorMessage(error: PostgrestError): string {
  const text = `${error.message} ${error.hint ?? ""}`;

  if (/max_services/.test(text))
    return "Достигнат е лимитът на услуги за твоя план. Премахни услуга или избери по-голям план.";
  if (/max_images/.test(text))
    return "Достигнат е лимитът на снимки за твоя план.";
  if (/max_locations/.test(text))
    return "Твоят план позволява само един адрес.";
  if (/max_team_members/.test(text))
    return "Достигнат е лимитът на членове на екипа за твоя план.";
  if (/online booking/.test(text))
    return "Онлайн записването е включено в плановете Professional и Premium.";
  if (/too_many_businesses|creation limit/.test(text))
    return "Един акаунт може да създаде най-много 5 бизнеса. Свържи се с нас, ако имаш нужда от повече.";
  if (/location_far_from_city|too far/.test(text))
    return "Точката на картата е твърде далеч от избрания град.";
  if (/invalid_city/.test(text)) return "Избраният град не е наличен.";
  if (/invalid_category/.test(text)) return "Избраната категория не е налична.";
  if (/cannot be submitted/.test(text))
    return "Профилът вече е изпратен или одобрен.";
  if (error.code === "23P01")
    return "Интервалите в един ден не трябва да се застъпват.";
  if (
    error.code === "42501" ||
    /permission denied|row-level security/.test(text)
  )
    return "Нямаш права за това действие.";
  if (error.code === "23514") return "Някое от полетата е невалидно.";

  console.error("[dashboard] unexpected database error", error);
  return "Нещо се обърка. Опитай отново.";
}
