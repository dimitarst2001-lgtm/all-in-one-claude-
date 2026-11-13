import type { LucideIcon } from "lucide-react";
import {
  Car,
  Droplets,
  LifeBuoy,
  PlugZap,
  Sparkles,
  Wrench,
} from "lucide-react";

export type CategoryPreview = {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
  examples: readonly string[];
};

/**
 * Marketing preview of the launch categories. The authoritative, admin-
 * editable list lives in the `categories` table (Phase 2); this file only
 * drives static marketing copy and icon mapping by slug.
 */
export const categoryPreviews: readonly CategoryPreview[] = [
  {
    slug: "auto-repair",
    name: "Автосервизи",
    description: "Ремонт, диагностика и обслужване от проверени сервизи.",
    icon: Wrench,
    examples: ["Диагностика", "Двигател", "Спирачки", "Климатик"],
  },
  {
    slug: "roadside-assistance",
    name: "Пътна помощ",
    description:
      "Репатриране, подаване на ток и смяна на гума, когато е спешно.",
    icon: LifeBuoy,
    examples: ["Репатриране", "Подаване на ток", "Гориво", "24/7"],
  },
  {
    slug: "tire-services",
    name: "Гуми",
    description: "Смяна, баланс, ремонт и съхранение на гуми.",
    icon: Car,
    examples: ["Сезонна смяна", "Баланс", "Геометрия", "Хотел за гуми"],
  },
  {
    slug: "car-wash",
    name: "Автомивки",
    description: "Автоматично, ръчно и самообслужващо измиване.",
    icon: Droplets,
    examples: ["Ръчно измиване", "Самообслужване", "Интериор", "Тапицерия"],
  },
  {
    slug: "car-detailing",
    name: "Детайлинг",
    description: "Полиране, керамични покрития и защитно фолио.",
    icon: Sparkles,
    examples: ["Полиране", "Керамика", "PPF фолио", "Фарове"],
  },
  {
    slug: "charging-stations",
    name: "Зарядни станции",
    description: "Карта на публичните зарядни станции за електромобили.",
    icon: PlugZap,
    examples: ["CCS", "Type 2", "CHAdeMO", "AC / DC"],
  },
];
