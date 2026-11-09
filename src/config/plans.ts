export type PlanPreview = {
  code: "starter" | "professional" | "premium";
  name: string;
  priceEur: number;
  highlight?: boolean;
  features: readonly string[];
};

/**
 * Marketing copy for the initial plan proposals (product assumptions, not
 * final commercial terms). Billing and entitlements read the
 * `subscription_plans` / `plan_features` tables, never this file.
 */
export const planPreviews: readonly PlanPreview[] = [
  {
    code: "starter",
    name: "Starter",
    priceEur: 9.99,
    features: [
      "Бизнес профил",
      "Телефон и адрес",
      "До 5 услуги",
      "До 5 снимки",
    ],
  },
  {
    code: "professional",
    name: "Professional",
    priceEur: 19.99,
    highlight: true,
    features: [
      "Всичко от Starter",
      "Неограничен брой услуги",
      "До 20 снимки",
      "Онлайн резервации",
      "Разширена статистика",
    ],
  },
  {
    code: "premium",
    name: "Premium",
    priceEur: 39.99,
    features: [
      "Всичко от Professional",
      "До 50 снимки",
      "Приоритетно позициониране",
      "Разширен бизнес профил",
    ],
  },
];
