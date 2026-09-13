export function cx(...xs: Array<string | false | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

export function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function unique<T>(arr: T[]): T[] {
  return arr.filter((x, i) => arr.indexOf(x) === i);
}
