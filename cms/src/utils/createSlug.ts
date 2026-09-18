export function createSlug(input: string): string {
  return input
    .normalize("NFD") // Normalize accented characters
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces, underscores, and multiple dashes with single dash
    .replace(/^-+|-+$/g, ""); // Trim leading and trailing dashes
}
