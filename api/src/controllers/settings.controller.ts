import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { doValidate } from "../utils/doValidate";
import { httpResponse } from "../utils/httpResponse";
import Joi from "joi";

const ALLOWED_KEYS = ["gst_percentage", "shipping_charge"] as const;
type SettingKey = (typeof ALLOWED_KEYS)[number];

export interface IStoreSettings {
  gst_percentage: number;
  shipping_charge: number;
}

export const getSettings = asyncErrorHandler(async (_req, res) => {
  const { rows } = await pool.query<{ key: string; value: string }>(
    `SELECT key, value FROM store_settings WHERE key = ANY($1)`,
    [ALLOWED_KEYS],
  );

  const settings: Record<string, number> = {};
  for (const row of rows) {
    settings[row.key] = parseFloat(row.value);
  }

  httpResponse(res, 200, "Store settings", settings);
});

const VSaveSettings = Joi.object({
  gst_percentage: Joi.number().min(0).max(100).required().label("GST %"),
  shipping_charge: Joi.number().min(0).required().label("Shipping charge"),
});

export const saveSettings = asyncErrorHandler(async (req, res) => {
  const value = doValidate<IStoreSettings>(VSaveSettings, req.body ?? {});

  const entries: [SettingKey, string][] = [
    ["gst_percentage", value.gst_percentage.toString()],
    ["shipping_charge", value.shipping_charge.toString()],
  ];

  await Promise.all(
    entries.map(([key, val]) =>
      pool.query(
        `INSERT INTO store_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, val],
      ),
    ),
  );

  httpResponse(res, 200, "Settings saved successfully");
});

export async function fetchSettingsFromDb(): Promise<IStoreSettings> {
  const { rows } = await pool.query<{ key: string; value: string }>(
    `SELECT key, value FROM store_settings WHERE key = ANY($1)`,
    [ALLOWED_KEYS],
  );
  const map: Record<string, number> = {};
  for (const row of rows) map[row.key] = parseFloat(row.value);
  return {
    gst_percentage: map["gst_percentage"] ?? 3,
    shipping_charge: map["shipping_charge"] ?? 0,
  };
}
