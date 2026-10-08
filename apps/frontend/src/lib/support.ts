import * as Sentry from "@sentry/nextjs";

// Set NEXT_PUBLIC_SUPPORT_EMAIL to change it (the API's SUPPORT_EMAIL matches it).
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@microbuiltprime.com";
/** "Help & support": the public page, where the assistant and the team are. */
export const SUPPORT_HREF = "/support";
/** When chat support is switched off (`enabled: false`), every entry point emails the team instead. */
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("MicroBuilt Prime: help needed")}`;
export const SUPPORT_HOURS = "Monday to Friday, 9:00 to 17:00 (Lagos time)";

/**
 * Opens Sentry's feedback form (a message, an optional screenshot, sent with the page and the signed-in user). Without
 * Sentry (no DSN), it falls back to an email to support.
 */
export async function reportProblem() {
  const feedback = Sentry.getFeedback();
  if (!feedback) {
    window.location.assign(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Problem report")}&body=${encodeURIComponent(
        `Page: ${window.location.href}

What happened:
`
      )}`
    );
    return;
  }
  const form = await feedback.createForm({
    formTitle: "Report a problem",
    messagePlaceholder: "What happened, and what did you expect?",
    submitButtonLabel: "Send report",
    successMessageText: "Thanks, we've got your report.",
  });
  form.appendToDom();
  form.open();
}
