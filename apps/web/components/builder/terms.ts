/** [key, label, linked phrase → page]. The link stays inside the label so the checkbox's accessible name is unchanged. */
export const TERMS = [
  ["terms", "I accept the Terms of Service.", ["Terms of Service", "/terms"]],
  ["cancellationPolicy", "I understand the cancellation policy for this departure.", null],
  [
    "travelResponsibility",
    "I understand I am responsible for my own flights, insurance and documents.",
    null,
  ],
  ["privacyPolicy", "I accept the Privacy Policy.", ["Privacy Policy", "/privacy"]],
] as const;
