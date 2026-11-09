import type { Metadata } from "next";

import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Политика за бисквитките",
  description: "Какви бисквитки използва All in One Auto.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Политика за бисквитките"
      description="Какви бисквитки използваме и защо."
    >
      <section>
        <h2>Строго необходими бисквитки</h2>
        <p>
          Използваме само бисквитки, без които сайтът не може да работи: за вход
          в акаунта и за сигурността на сесията. Те не изискват съгласие.
        </p>
      </section>
      <section>
        <h2>Аналитични и маркетингови бисквитки</h2>
        <p>
          В момента не използваме такива. Ако започнем, ще поискаме изричното ти
          съгласие преди да ги зададем.
        </p>
      </section>
    </LegalPage>
  );
}
