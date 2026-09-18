import Joi from "joi";

export const VUpdatePaymentStatus = Joi.object({
  orderid: Joi.number().required(),
  status: Joi.string()
    .required()
    .valid("PENDING", "PAID", "FAILED", "REFUNDED"),
});

/**
 * The gateway return page. provider_order_id is what new payment links carry;
 * merchant_order_id is the name PhonePe links minted before the gateway
 * interface used, and is accepted so those older orders still land somewhere.
 */
export const VCheckPaymentStatus = Joi.object({
  provider_order_id: Joi.string(),
  merchant_order_id: Joi.string(),
})
  .or("provider_order_id", "merchant_order_id")
  // PhonePe appends its own fields to the redirect, and a stray query
  // parameter should not turn a successful payment into a 400.
  .unknown(true);

/**
 * The refund an admin submits from the CMS.
 *
 * amount is always explicit — the dialog prefills it with what is left to
 * refund, and the admin may lower it — so nothing is ever guessed here.
 *
 * A skipped refund moves no money through us: it only records that the admin
 * settled it somewhere else, which is worthless without saying where, so the
 * note is required on that path and optional on the other.
 */
export const VRefundPayment = Joi.object({
  orderid: Joi.number().required(),
  amount: Joi.number().positive().precision(2).required(),
  skip_gateway: Joi.boolean().default(false),
  note: Joi.when("skip_gateway", {
    is: true,
    then: Joi.string().trim().min(3).max(500).required().messages({
      "any.required":
        "A note is required when the refund is not going through the gateway",
    }),
    otherwise: Joi.string().trim().allow("").max(500).default(""),
  }),
});
