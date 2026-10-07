// Where "Help & support" goes until there is a support page. Set NEXT_PUBLIC_SUPPORT_EMAIL to change it.
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@microbuiltprime.com";
export const SUPPORT_HREF = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("MicroBuilt Prime: help needed")}`;
