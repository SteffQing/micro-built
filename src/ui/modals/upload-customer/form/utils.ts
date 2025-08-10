function getNested(obj: unknown, path: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return path.split(".").reduce((acc: any, key) => acc?.[key], obj);
}

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function formatYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function parseYYYYMMDD(s: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map((v) => Number.parseInt(v, 10));
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return isValidDate(date) ? date : undefined;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function endOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

function formatDisplay(d?: Date) {
  if (!d) return "";
  // Example: Mon, Jan 1, 2024
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export {
  getNested,
  isValidDate,
  pad2,
  formatYYYYMMDD,
  parseYYYYMMDD,
  startOfDay,
  endOfDay,
  formatDisplay,
};
