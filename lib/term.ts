export const TERM_OPTIONS = [1, 2, 3, 4] as const;

export const TERM_LABELS: Record<(typeof TERM_OPTIONS)[number], string> = {
  1: "1 month",
  2: "2 months",
  3: "3 months (trimester)",
  4: "4 months",
};

export function termEndFor(months: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}
