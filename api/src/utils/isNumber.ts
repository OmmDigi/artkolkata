export function isNumber(value: any): boolean {
  if (value === null || value === undefined) return false;

  const num = Number(value);
  return !isNaN(num);
}
