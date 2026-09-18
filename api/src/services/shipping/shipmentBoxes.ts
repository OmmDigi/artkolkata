/**
 * The boxes a shipment actually ships in, as keyed into the CMS by the admin
 * and stored on orders.shipment_boxes.
 *
 * Partner-neutral on purpose: every partner books against the same boxes, they
 * only differ in what they do with more than one of them.
 */

/** One box, in kg and cm, as the CMS stores it. */
export interface IShipmentBox {
  weight_kg: string | number;
  length_cm: string | number;
  breadth_cm: string | number;
  height_cm: string | number;
}

/** The same box in the units every partner client takes. */
export interface ShipmentBox {
  weight: number;
  length: number;
  breadth: number;
  height: number;
}

const num = (raw: string | number | undefined) => {
  const parsed = parseFloat(String(raw));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

// Rows keyed in by hand can be blank or half-filled — only a row with all four
// measurements describes a real box, so the rest are discarded rather than sent
// as NaN, which couriers answer with a generic 400.
export const parseShipmentBoxes = (raw: any): ShipmentBox[] => {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((box: IShipmentBox) => {
    const weight = num(box?.weight_kg);
    const length = num(box?.length_cm);
    const breadth = num(box?.breadth_cm);
    const height = num(box?.height_cm);

    if (!weight || !length || !breadth || !height) return [];

    return [{ weight, length, breadth, height }];
  });
};

/**
 * Several boxes declared as one package: the weights add up, but a single box
 * can only be as long, wide or tall as the largest of them. Used by partners
 * whose booking API carries exactly one package.
 */
export const consolidateBoxes = (boxes: ShipmentBox[]): ShipmentBox =>
  boxes.reduce(
    (acc, box) => ({
      weight: acc.weight + box.weight,
      length: Math.max(acc.length, box.length),
      breadth: Math.max(acc.breadth, box.breadth),
      height: Math.max(acc.height, box.height),
    }),
    { weight: 0, length: 0, breadth: 0, height: 0 },
  );
