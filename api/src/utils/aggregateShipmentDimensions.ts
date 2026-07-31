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

  for (const item of items) {
    totalWeight += parseFloat(String(item.weight_kg)) * item.quantity;
    maxLength = Math.max(maxLength, parseFloat(String(item.length_cm)));
    maxBreadth = Math.max(maxBreadth, parseFloat(String(item.breadth_cm)));
    maxHeight = Math.max(maxHeight, parseFloat(String(item.height_cm)));
  }

  return {
    weight: totalWeight > 0 ? totalWeight : 0.5,
    length: maxLength,
    breadth: maxBreadth,
    height: maxHeight,
  };
};
