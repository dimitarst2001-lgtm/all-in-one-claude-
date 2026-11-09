import { publicEnv, siteUrl } from "@/lib/env/public";

export const siteConfig = {
  name: "All in One Auto",
  shortName: "AIO Auto",
  slogan: "Всичко за твоя автомобил. На едно място.",
  sloganEn: "Everything your car needs. In one place.",
  description:
    "Намери доверени автосервизи, пътна помощ, гуми, автомивки и зарядни станции за електромобили в цяла България.",
  url: siteUrl,
  locale: "bg_BG",
  launchCity: "Варна",
  contact: {
    email: publicEnv.NEXT_PUBLIC_CONTACT_EMAIL,
    phone: publicEnv.NEXT_PUBLIC_CONTACT_PHONE,
  },
} as const;
