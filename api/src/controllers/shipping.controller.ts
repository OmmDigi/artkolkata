import Joi from "joi";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import ShiprocketService from "../services/shiprocketService";

const VCheckServiceability = Joi.object({
  pincode: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({ "string.pattern.base": "Pincode must be 6 digits" }),
  weight: Joi.number().positive().optional().default(0.5),
  cod: Joi.boolean().optional().default(false),
});

export const checkServiceability = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{ pincode: string; weight: number; cod: boolean }>(
    VCheckServiceability,
    req.query ?? {},
  );

  const result = await ShiprocketService.checkServiceability(
    value.pincode,
    value.weight,
    value.cod,
  );

  if (!result.success) {
    throw new ErrorHandler(500, "Unable to check pincode availability right now");
  }

  httpResponse(res, 200, "Pincode check complete", {
    serviceable:    result.serviceable,
    shippingCharge: result.shippingCharge ?? 0,
    courierName:    result.courierName ?? null,
    estimatedDays:  result.estimatedDays ?? null,
    codAvailable:   result.codAvailable ?? false,
  });
});
