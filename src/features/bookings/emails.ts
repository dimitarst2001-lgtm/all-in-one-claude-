import "server-only";

import { escapeHtml, sendEmail } from "@/lib/email/send";
import { siteUrl } from "@/lib/env/public";

import { formatBookingRange } from "./format";
import { bookingStatusLabels, type BookingNotice } from "./types";

/**
 * Booking notification e-mails. They are best-effort: when Resend is not
 * configured nothing is sent and the in-app state remains the source of truth.
 */

function details(notice: BookingNotice) {
  const when = formatBookingRange(
    notice.starts_at,
    notice.ends_at,
    notice.timezone,
  );
  const services = notice.services.length
    ? notice.services.join(", ")
    : "без избрана услуга";
  return { when, services, where: `${notice.address}, ${notice.city_name}` };
}

function render(lines: string[], link?: { href: string; label: string }) {
  const text = [...lines, ...(link ? ["", `${link.label}: ${link.href}`] : [])]
    .join("\n")
    .trim();
  const html = [
    ...lines.map((line) => (line ? `<p>${escapeHtml(line)}</p>` : "")),
    link
      ? `<p><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></p>`
      : "",
  ].join("");
  return { text, html };
}

export async function notifyBookingCreated(notice: BookingNotice) {
  const { when, services, where } = details(notice);
  const confirmed = notice.status === "confirmed";

  await sendEmail({
    to: notice.customer_email,
    subject: confirmed
      ? `Часът ти в ${notice.business_name} е потвърден`
      : `Заявката ти до ${notice.business_name} е изпратена`,
    ...render(
      [
        `Здравей, ${notice.customer_name}!`,
        confirmed
          ? "Часът ти е потвърден."
          : "Бизнесът ще потвърди часа. Ще получиш имейл, когато отговори.",
        "",
        `Кога: ${when}`,
        `Къде: ${notice.business_name}, ${where}`,
        `Услуги: ${services}`,
        notice.business_phone ? `Телефон: ${notice.business_phone}` : "",
      ],
      { href: `${siteUrl}/account/bookings`, label: "Моите резервации" },
    ),
  });

  if (notice.business_email) {
    await sendEmail({
      to: notice.business_email,
      subject: `Нова резервация: ${when}`,
      ...render(
        [
          confirmed
            ? "Имате нова потвърдена резервация."
            : "Имате нова заявка за час, която чака потвърждение.",
          "",
          `Кога: ${when}`,
          `Клиент: ${notice.customer_name}, ${notice.customer_phone}`,
          `Услуги: ${services}`,
        ],
        {
          href: `${siteUrl}/dashboard/${notice.business_id}/bookings`,
          label: "Отвори резервациите",
        },
      ),
    });
  }
}

export async function notifyBookingStatus(notice: BookingNotice) {
  const { when, where } = details(notice);
  await sendEmail({
    to: notice.customer_email,
    subject: `${notice.business_name}: резервацията ти е „${bookingStatusLabels[notice.status]}“`,
    ...render(
      [
        `Здравей, ${notice.customer_name}!`,
        `Статусът на резервацията ти е променен на „${bookingStatusLabels[notice.status]}“.`,
        notice.status_reason ? `Причина: ${notice.status_reason}` : "",
        "",
        `Кога: ${when}`,
        `Къде: ${notice.business_name}, ${where}`,
      ],
      { href: `${siteUrl}/account/bookings`, label: "Моите резервации" },
    ),
  });
}

export async function notifyBookingCancelledByCustomer(notice: BookingNotice) {
  if (!notice.business_email) return;
  const { when } = details(notice);
  await sendEmail({
    to: notice.business_email,
    subject: `Отменена резервация: ${when}`,
    ...render(
      [
        `${notice.customer_name} отмени резервацията си.`,
        "",
        `Кога: ${when}`,
        `Клиент: ${notice.customer_name}, ${notice.customer_phone}`,
      ],
      {
        href: `${siteUrl}/dashboard/${notice.business_id}/bookings`,
        label: "Отвори резервациите",
      },
    ),
  });
}
