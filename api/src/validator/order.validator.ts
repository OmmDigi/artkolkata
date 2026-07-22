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
