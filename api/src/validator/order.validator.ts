import Joi from "joi";

export const VShippingAddress = Joi.object({
  fullName: Joi.string().required(),
  email: Joi.string().required(),
  phone: Joi.string().required(),
  address: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  pincode: Joi.string().required(),
  country: Joi.string().required(),
});

export const VCreateOrder = Joi.object({
  shippingDetails: VShippingAddress.required(),

  paymentMethod: Joi.string().valid("ONLINE", "COD").required(),

  product: Joi.object({
    code: Joi.string().optional(),
    product_ids: Joi.array()
      .items(
        Joi.object({
          id: Joi.number().required(),
          quantity: Joi.number().required(),
        }),
      )
      .required(),
    varient_ids: Joi.array()
      .items(
        Joi.object({
          id: Joi.number().required(),
          quantity: Joi.number().required(),
        }),
      )
      .required(),
  }),
});

export const VGetPriceBreakdown = Joi.object({
  pincode: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({ "string.pattern.base": "Pincode must be 6 digits" }),

  paymentMethod: Joi.string().valid("ONLINE", "COD").required(),

  product: Joi.object({
    code: Joi.string().optional(),
    product_ids: Joi.array()
      .items(
        Joi.object({
          id: Joi.number().required(),
          quantity: Joi.number().required(),
        }),
      )
      .required(),
    varient_ids: Joi.array()
      .items(
        Joi.object({
          id: Joi.number().required(),
          quantity: Joi.number().required(),
        }),
      )
      .required(),
  }).required(),
});

export const VUpdateOrderStatus = Joi.object({
  order_id: Joi.number().optional(),
  order_item_id: Joi.when("order_id", {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  status: Joi.string()
    .required()
    .valid(
      "PENDING",
      "CONFIRMED",
      "PACKED",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "RETURNED",
    ),
});

// The boxes an admin keys in against an order before confirming it. Bigship
// types the box edges as int cm and rejects a decimal outright, so they are
// held to integers here rather than silently rounded at booking time.
export const VUpdateShipmentBoxes = Joi.object({
  boxes: Joi.array()
    .min(1)
    .items(
      Joi.object({
        weight_kg: Joi.number().greater(0).required(),
        length_cm: Joi.number().integer().greater(0).required(),
        breadth_cm: Joi.number().integer().greater(0).required(),
        height_cm: Joi.number().integer().greater(0).required(),
      }),
    )
    .required(),
  // Bigship wants exactly 12 digits, and only on B2B shipments at or above
  // 50,000. Optional here — updateOrderStatus is what enforces it.
  ewaybill_number: Joi.string()
    .pattern(/^\d{12}$/)
    .allow("", null)
    .optional()
    .messages({
      "string.pattern.base": "Ewaybill number must be exactly 12 digits",
    }),
  // PDF or JPEG as a Data URI — the form Bigship accepts it in.
  ewaybill_document: Joi.string()
    .pattern(/^data:(application\/pdf|image\/jpeg);base64,/)
    .max(6 * 1024 * 1024)
    .allow("", null)
    .optional()
    .messages({
      "string.pattern.base": "Ewaybill document must be a PDF or JPEG file",
      "string.max": "Ewaybill document is too large",
    }),
});

// The invoice an admin uploads against an order. Restricted to PDF and JPEG
// because the same file is what a B2B shipment is booked with, and those are
// the only two formats Bigship accepts there.
export const VUploadOrderInvoice = Joi.object({
  invoice_document: Joi.string()
    .pattern(/^data:(application\/pdf|image\/jpeg);base64,/)
    .max(8 * 1024 * 1024)
    .required()
    .messages({
      "string.pattern.base": "Invoice must be a PDF or JPEG file",
      "string.max": "Invoice file is too large",
    }),
});

export const VReturnOrder = Joi.object({
  order_id: Joi.string().required(),
  type: Joi.string().valid("Return", "Replace").required(),
  // order_item_id: Joi.when("order_id", {
  //   is: Joi.exist(),
  //   then: Joi.optional(),
  //   otherwise: Joi.required(),
  // }),

  // status: Joi.string()
  //   .required()
  //   .valid(
  //     "PENDING",
  //     "CONFIRMED",
  //     "PACKED",
  //     "SHIPPED",
  //     "DELIVERED",
  //     "CANCELLED",
  //     "RETURNED"
  //   ),
});

export const VCancelOrder = Joi.object({
  order_id: Joi.string().optional(),
  order_item_id: Joi.when("order_id", {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),

  // status: Joi.string().required().valid("CANCELLED"),
});

export const VTrackOrder = Joi.object({
  order_number: Joi.string().required(),
});
