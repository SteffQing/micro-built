/** "Ada Obi" → "Ada"; nothing for an empty name. */
export const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || undefined;
