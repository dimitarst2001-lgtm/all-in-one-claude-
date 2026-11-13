export type NavItem = {
  title: string;
  href: string;
  description?: string;
};

/**
 * Primary navigation. Only routes that exist are listed; new sections are
 * added here as their phases ship (see ROADMAP.md), so there are never links
 * that lead nowhere.
 */
export const mainNav: readonly NavItem[] = [
  { title: "Услуги", href: "/#categories" },
  { title: "Как работи", href: "/#how-it-works" },
  { title: "За бизнеси", href: "/for-businesses" },
];

export const legalNav: readonly NavItem[] = [
  { title: "Политика за поверителност", href: "/privacy" },
  { title: "Общи условия", href: "/terms" },
  { title: "Политика за бисквитките", href: "/cookies" },
];
