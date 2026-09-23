import Joi from "joi";
import { MAX_BULK_INVOICES, ORDER_STATUSES } from "../constant";

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

/**
 * A GSTIN: 15 characters, and the layout is fixed by the GST system itself —
 * 2 digit state code, the holder's 10 character PAN, a 1 character entity
 * number, a literal "Z", and a checksum character.
 *
 * Checked rather than waved through because this number is printed on a tax
 * document the buyer files against. A typo that reaches the invoice is found
 * weeks later by an accountant; a typo caught here is found by the customer
 * while they are still looking at the field.
 *
 * Case is not significant on the way in — normalised to upper case below,
 * which is how a GSTIN is written.
 */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const VGstDetails = Joi.object({
  gstNumber: Joi.string()
    .trim()
    .uppercase()
    .pattern(GSTIN_PATTERN)
    .required()
    .messages({
      "string.pattern.base":
        "Enter a valid 15 character GSTIN, for example 29ABCDE1234F1Z5",
      "string.empty": "GST number is required when billing to a business",
    }),

  // An invoice carrying a GSTIN has to name the entity it belongs to, so the
  // two travel together or not at all.
  businessName: Joi.string().trim().min(2).max(200).required().messages({
    "string.empty": "Business name is required when a GST number is given",
  }),
});

export const VCreateOrder = Joi.object({
  shippingDetails: VShippingAddress.required(),

  paymentMethod: Joi.string().valid("ONLINE", "COD").required(),

  /**
   * Optional: only a customer buying as a business sends this. The storefront
   * puts it behind a "I have a GST number" checkbox and omits the key
   * entirely when the box is unticked.
   */
  gstDetails: VGstDetails.optional(),

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
  // Every status an order can actually hold, taken from the constants rather
  // than written out again. The list used to be a literal here and had drifted:
  // the webhook writes OUT FOR DELIVERY and the return flow writes the RETURN
  // and REPLACE statuses by raw SQL, so they never hit this schema, and an
  // admin setting one by hand was rejected for a status the order was already
  // allowed to be in.
  status: Joi.string().required().valid(...ORDER_STATUSES),
});

/**
 * Park an order or bring it back. A bare boolean, and required: the CMS sends
 * the state it wants rather than a toggle, so two admins pressing at once
 * cannot flip it back and forth.
 */
export const VSetOrderDraft = Joi.object({
  is_draft: Joi.boolean().required(),
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

export const VBulkInvoice = Joi.object({
  order_ids: Joi.array()
    .items(Joi.number().integer().positive())
    .min(1)
    .max(MAX_BULK_INVOICES)
    .unique()
    .required()
    .messages({
      "array.min": "Select at least one order",
      "array.max": `At most ${MAX_BULK_INVOICES} invoices can be downloaded at once`,
    }),
});
