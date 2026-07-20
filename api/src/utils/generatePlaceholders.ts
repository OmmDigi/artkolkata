export function generatePlaceholders(rowCount: number, columnsPerRow: number): string {
  return Array.from({ length: rowCount }, (_, i) => {
    const offset = i * columnsPerRow;
    const placeholders = Array.from(
      { length: columnsPerRow },
      (_, j) => `$${offset + j + 1}`
    );
    return `(${placeholders.join(", ")})`;
  }).join(", ");
}
