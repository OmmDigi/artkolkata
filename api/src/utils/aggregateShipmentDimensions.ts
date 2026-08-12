export interface IShipmentDimensionInput {
  weight_kg: string | number;
  length_cm: string | number;
  breadth_cm: string | number;
  height_cm: string | number;
  quantity: number;
}

// Total weight of a shipment is the sum of every item's weight, but a single
// box can only be as long/wide/tall as its largest item, so dimensions take
// the max rather than the sum. This is an approximation, not real bin-packing.
export const aggregateShipmentDimensions = (items: IShipmentDimensionInput[]) => {
  let totalWeight = 0;
  let maxLength = 10;
  let maxBreadth = 10;
  let maxHeight = 10;

  // Items snapshotted before the dimension columns existed have no measurements
  // at all, and one NaN would poison the whole box. Skip what we cannot read
  // and let the per-field defaults stand.
  const num = (raw: string | number | undefined) => {
    const parsed = parseFloat(String(raw));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  for (const item of items) {
    const weight = num(item.weight_kg);
    const length = num(item.length_cm);
    const breadth = num(item.breadth_cm);
    const height = num(item.height_cm);

    if (weight) totalWeight += weight * item.quantity;
    if (length) maxLength = Math.max(maxLength, length);
    if (breadth) maxBreadth = Math.max(maxBreadth, breadth);
    if (height) maxHeight = Math.max(maxHeight, height);
  }

  // Bigship types the box dimensions as int (cm) — a decimal makes the whole
  // request body fail to bind. Round up so the declared box is never smaller
  // than the goods. Weight is a decimal there, but keep it to 3 places to
  // match products.weight_kg and avoid float noise like 0.30000000000000004.
  return {
    weight: totalWeight > 0 ? parseFloat(totalWeight.toFixed(3)) : 0.5,
    length: Math.ceil(maxLength),
    breadth: Math.ceil(maxBreadth),
    height: Math.ceil(maxHeight),
  };
};
