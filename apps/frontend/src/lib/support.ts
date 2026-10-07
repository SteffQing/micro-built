import * as Sentry from "@sentry/nextjs";

// Where "Help & support" goes until there is a support page. Set NEXT_PUBLIC_SUPPORT_EMAIL to change it.
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@microbuiltprime.com";
export const SUPPORT_HREF = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("MicroBuilt Prime: help needed")}`;

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
