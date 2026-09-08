import { brand, emails } from "@guideless/config";
import { formatDate } from "@guideless/utils";

export interface BookingConfirmedProps {
  tourName: string;
  dates: string;
  confirmationNumber: string;
  amountPaid: string;
  balance: string | null;
  balanceDueDate: string | null;
  accountUrl: string;
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Version-controlled template (spec §65). Plain, calm, no marketing. */
export function bookingConfirmedEmail(p: BookingConfirmedProps): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `You're booked: ${p.tourName}${p.dates ? `, ${p.dates}` : ""}`;
  const balanceLine = p.balance
    ? `Balance of ${p.balance} is due ${p.balanceDueDate ? formatDate(p.balanceDueDate) : "before departure"}.`
    : "You're paid in full.";

  const text = [
    `${brand.name}`,
    ``,
    `Your place is confirmed.`,
    ``,
    `${p.tourName}${p.dates ? ` · ${p.dates}` : ""}`,
    `Confirmation ${p.confirmationNumber}`,
    ``,
    `Paid today: ${p.amountPaid}`,
    balanceLine,
    ``,
    `What happens next: we'll send arrival instructions and your group details as the trip approaches — 90, 30 and 7 days out. Nothing to do right now.`,
    ``,
    `Your bookings: ${p.accountUrl}`,
    ``,
    `${brand.tagline}`,
    `${emails.support}`,
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#F5F6F2;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#0B2025">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="font-weight:700;font-size:18px;margin:0 0 24px">${esc(brand.name)}</p>
    <div style="background:#FFFFFF;border:1px solid #DAD9D0;border-radius:16px;padding:28px">
      <p style="margin:0;color:#586266;font-size:12px;letter-spacing:.18em;text-transform:uppercase">Confirmed</p>
      <h1 style="margin:8px 0 4px;font-size:26px;line-height:1.15">Your place is confirmed.</h1>
      <p style="margin:0 0 20px;color:#586266">${esc(p.tourName)}${p.dates ? ` · ${esc(p.dates)}` : ""}</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px">
        <tr><td style="padding:8px 0;color:#586266">Confirmation</td><td style="padding:8px 0;text-align:right;font-weight:600">${esc(p.confirmationNumber)}</td></tr>
        <tr><td style="padding:8px 0;color:#586266;border-top:1px solid #DAD9D0">Paid today</td><td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #DAD9D0">${esc(p.amountPaid)}</td></tr>
        <tr><td style="padding:8px 0;color:#586266;border-top:1px solid #DAD9D0">Balance</td><td style="padding:8px 0;text-align:right;border-top:1px solid #DAD9D0">${esc(balanceLine)}</td></tr>
      </table>
      <p style="margin:24px 0 0;line-height:1.6">What happens next: we'll send arrival instructions and your group details as the trip approaches — 90, 30 and 7 days out. Nothing to do right now.</p>
      <p style="margin:24px 0 0"><a href="${esc(p.accountUrl)}" style="display:inline-block;background:#0B2025;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Your bookings</a></p>
    </div>
    <p style="margin:24px 0 0;color:#586266;font-size:13px">${esc(brand.tagline)} · <a href="mailto:${esc(emails.support)}" style="color:#17B1DF">${esc(emails.support)}</a></p>
  </div>
</body></html>`;

  return { subject, html, text };
}
