import Joi from "joi";

export const VUpdatePaymentStatus = Joi.object({
  orderid: Joi.number().required(),
  status: Joi.string()
    .required()
    .valid("PENDING", "PAID", "FAILED", "REFUNDED"),
});

export const VCheckPhonePeStatus = Joi.object({
  merchant_order_id: Joi.string().required(),
});