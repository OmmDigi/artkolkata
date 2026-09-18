import { loadEnvFile } from "process";
import { loadEnv } from "./loadEnv";

/**
 * Shiprocket smoke test.
 *
 *   npx ts-node src/utils/testShiprocket.ts            # offline checks + live read-only calls
 *   npx ts-node src/utils/testShiprocket.ts --book 12  # ALSO books DB order 12 for real
 *
 * The offline section needs no credentials and no network — it exercises the
 * translation logic, which is where the bugs that silently corrupt an order
 * status live. The live section is skipped unless SHIPROCKET_EMAIL and
 * SHIPROCKET_PASSWORD are set, and is read-only: it logs in and asks for rates.
 *
 * --book is the only destructive flag. It creates a REAL order in the
 * Shiprocket panel and assigns a REAL AWB against the DB order you name, which
 * consumes wallet balance and has to be cancelled by hand. Nothing books
 * without it.
 */
loadEnv();

let passed = 0;
let failed = 0;

const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? passed++ : failed++;
  console.log(
    `  ${ok ? "✅" : "❌"} ${label}` +
      (ok ? "" : `\n       expected ${JSON.stringify(expected)}\n       got      ${JSON.stringify(actual)}`),
  );
};

async function main() {
  // Imported here, not at the top: the service reads its config in the
  // constructor, so it must not be loaded until dotenv has run.
  const { default: ShiprocketService, normalizeStatusLabel, parseShiprocketDateTime } =
    await import("../services/shipping/shiprocket.client");
  const { SHIPMENT_MAPING } = await import("../constant");

  // ============================================================
  // OFFLINE — no credentials, no network
  // ============================================================
  console.log("\n── Status label normalisation ──");
  check("underscores become spaces", normalizeStatusLabel("RTO_INITIATED"), "RTO INITIATED");
  check("case is folded", normalizeStatusLabel("Out for Delivery"), "OUT FOR DELIVERY");
  check("padding is trimmed", normalizeStatusLabel("  in   transit "), "IN TRANSIT");
  check("undefined is safe", normalizeStatusLabel(undefined), "");

  console.log("\n── IST timestamps → UTC ──");
  // IST is UTC+5:30, so 18:30 IST is 13:00 UTC. A parser that forgot the shift
  // would answer 18:30Z, and one that read the string as server-local time
  // would answer something else again — both differ from the expectation here.
  check("space-separated", parseShiprocketDateTime("2024-05-02 18:30:00"), "2024-05-02T13:00:00.000Z");
  check("T-separated", parseShiprocketDateTime("2024-05-02T18:30:00"), "2024-05-02T13:00:00.000Z");
  check("no seconds", parseShiprocketDateTime("2024-05-02 18:30"), "2024-05-02T13:00:00.000Z");
  // 05:30 IST is midnight UTC — the shift has to roll the date back a day.
  check("rolls back across midnight", parseShiprocketDateTime("2024-05-03 05:30:00"), "2024-05-03T00:00:00.000Z");
  check("rolls back before midnight", parseShiprocketDateTime("2024-05-03 04:00:00"), "2024-05-02T22:30:00.000Z");
  // Garbage must not become an Invalid Date, which would fail the DB insert.
  check("unparseable falls back to now", isNaN(new Date(parseShiprocketDateTime("not a date")).getTime()), false);

  console.log("\n── Every mapped status resolves to an order status ──");
  // The real risk: the service translates to a { StatusType, Status } pair,
  // and SHIPMENT_MAPING turns that pair into an order status. A typo in either
  // table means a delivered parcel silently never marks the order delivered.
  const statuses = [
    ["AWB ASSIGNED", "CONFIRMED"],
    ["PICKUP SCHEDULED", "CONFIRMED"],
    ["OUT FOR PICKUP", "CONFIRMED"],
    ["PICKED UP", "SHIPPED"],
    ["IN TRANSIT", "SHIPPED"],
    ["OUT FOR DELIVERY", "OUT FOR DELIVERY"],
    ["DELIVERED", "DELIVERED"],
    ["UNDELIVERED", "SHIPPED"],
    ["CANCELED", "CANCELLED"],
    ["RTO INITIATED", "CANCELLED"],
    ["RTO DELIVERED", "CANCELLED"],
  ];

  for (const [label, expected] of statuses) {
    const event = ShiprocketService.normalizeStatusEvent("AWB1", label, undefined, "", "");
    const key = `${event.Shipment.Status.StatusType}_${event.Shipment.Status.Status}`;
    check(`${label} → ${expected}`, SHIPMENT_MAPING[key], expected);
  }

  console.log("\n── Tracking history is oldest-first ──");
  // Shiprocket returns activities newest-first; webhook_data is read back in
  // insertion order, so the service has to flip them.
  const history = ShiprocketService.normalizeTrackingHistory(
    {
      shipment_track_activities: [
        { "sr-status-label": "DELIVERED", date: "2024-05-03 10:00:00", location: "Kolkata", activity: "Delivered" },
        { "sr-status-label": "OUT FOR DELIVERY", date: "2024-05-03 08:00:00", location: "Kolkata", activity: "Out" },
        { "sr-status-label": "PICKED UP", date: "2024-05-02 18:30:00", location: "Delhi", activity: "Picked" },
      ],
    },
    "AWB1",
  );
  check("event count", history.length, 3);
  check("oldest first", history[0].Shipment.Status.Status, "In Transit");
  check("newest last", history[2].Shipment.Status.Status, "Delivered");

  console.log("\n── Tracking with no courier scan yet ──");
  const noScans = ShiprocketService.normalizeTrackingHistory(
    { shipment_track: [{ current_status: "AWB ASSIGNED", origin: "Delhi" }] },
    "AWB1",
  );
  check("falls back to shipment status", noScans.length, 1);
  check("mapped as manifested", noScans[0].Shipment.Status.Status, "Manifested");

  console.log("\n── Webhook payload normalisation ──");
  const webhookEvents = ShiprocketService.normalizeWebhookEvents({
    awb: "AWB9",
    current_status: "DELIVERED",
    current_timestamp: "2024-05-03 10:00:00",
    scans: [
      { "sr-status-label": "DELIVERED", date: "2024-05-03 10:00:00", location: "Kolkata", activity: "Delivered" },
      { "sr-status-label": "IN TRANSIT", date: "2024-05-02 18:30:00", location: "Delhi", activity: "In transit" },
    ],
  });
  check("event count", webhookEvents.length, 2);
  check("oldest first", webhookEvents[0].Shipment.Status.Status, "In Transit");
  check("AWB carried through", webhookEvents[1].Shipment.AWB, "AWB9");
  check("no AWB → no events", ShiprocketService.normalizeWebhookEvents({ current_status: "DELIVERED" }).length, 0);

  const scanless = ShiprocketService.normalizeWebhookEvents({
    awb: "AWB9",
    current_status: "OUT FOR DELIVERY",
    current_timestamp: "2024-05-03 08:00:00",
  });
  check("scanless push still yields one event", scanless.length, 1);
  check("scanless push maps", scanless[0].Shipment.Status.Status, "Dispatched");

  console.log(`\n── Offline: ${passed} passed, ${failed} failed ──`);

  // ============================================================
  // LIVE — read-only, needs credentials
  // ============================================================
  if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
    console.log(
      "\n⏭  Live checks skipped — SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD not set in .env.local or .env",
    );
    process.exit(failed === 0 ? 0 : 1);
  }

  console.log("\n── Live: login + serviceability (read-only) ──");
  const destination = process.env.SHIPROCKET_TEST_PINCODE || "110001";

  const result = await ShiprocketService.checkServiceability(destination, 0.5, 500, false, {
    length: 10,
    breadth: 10,
    height: 10,
  });

  if (!result.success) {
    // A failure here is almost always one of three things: the API user was
    // never created under Settings -> API, the password is the dashboard one,
    // or WAREHOUSE_PINCODE is unset so the origin is blank.
    console.log("  ❌ Serviceability call failed:", result.error);
    console.log("     WAREHOUSE_PINCODE =", process.env.WAREHOUSE_PINCODE || "(unset)");
    process.exit(1);
  }

  console.log(`  ✅ Logged in and quoted ${process.env.WAREHOUSE_PINCODE} → ${destination}`);
  console.log("     serviceable  :", result.serviceable);
  console.log("     courier      :", result.courierName ?? "—");
  console.log("     rate         :", result.shippingCharge ?? "—");
  console.log("     est. days    :", result.estimatedDays ?? "—");
  console.log("     COD available:", result.codAvailable);

  // ============================================================
  // BOOK — destructive, opt-in
  // ============================================================
  const bookIndex = process.argv.indexOf("--book");
  if (bookIndex === -1) {
    console.log("\n⏭  Booking skipped — pass `--book <order_id>` to book a real shipment");
    process.exit(failed === 0 ? 0 : 1);
  }

  const orderId = parseInt(process.argv[bookIndex + 1] ?? "", 10);
  if (!orderId) {
    console.log("\n❌ `--book` needs a DB order id, e.g. --book 12");
    process.exit(1);
  }

  console.log(`\n── Live: booking DB order ${orderId} (REAL) ──`);
  const { ShiprocketPartner } = await import("../services/shipping/shiprocket.partner");
  const booking = await new ShiprocketPartner().createShippingOrder(orderId);

  console.log(booking.created ? "  ✅ Booked" : "  ❌ Not booked");
  console.log("     skipped :", booking.skipped ?? "—");
  console.log("     order id:", booking.partnerOrderId ?? "—");
  console.log("     shipment:", booking.partnerShipmentId ?? "—");
  console.log("     AWB     :", booking.waybill ?? "—");
  console.log("     courier :", booking.courierName ?? "—");
  if (booking.error) console.log("     error   :", booking.error);

  process.exit(failed === 0 && booking.created ? 0 : 1);
}

main().catch((err) => {
  console.error("\n❌ Smoke test threw:", err);
  process.exit(1);
});
