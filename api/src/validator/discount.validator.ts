import Joi from "joi";

export const VCreateDiscount = Joi.object({
  code: Joi.string().required(),
  title: Joi.string().required(),
  type: Joi.string().valid("percentage", "fixed_amount"),
  value: Joi.string().required(),
  status: Joi.string().valid("active", "scheduled", "expired", "disabled"),

  categories: Joi.string().optional(),

  min_amount_to_select: Joi.number()
    .required()
    .label("Minium amount to purchase"),

  starts_at: Joi.string().required(),
  ends_at: Joi.string().required(),
});

export const VUpdateDiscount = Joi.object({
  id: Joi.number().required(),
  code: Joi.string().required(),
  title: Joi.string().required(),
  type: Joi.string().valid("percentage", "fixed_amount"),
  value: Joi.string().required(),
  status: Joi.string().valid("active", "scheduled", "expired", "disabled"),

  categories: Joi.string().optional(),

  min_amount_to_select: Joi.number()
    .required()
    .label("Minium amount to purchase"),

  starts_at: Joi.string().required(),
  ends_at: Joi.string().required(),
});

export const VValidateDiscount = Joi.object({
  code: Joi.string().required(),
  product_ids: Joi.array()
    .items(
      Joi.object({
        id: Joi.number().required(),
        quantity: Joi.number().required(),
      })
    )
    .required(),
  varient_ids: Joi.array()
    .items(
      Joi.object({
        id: Joi.number().required(),
        quantity: Joi.number().required(),
      })
    )
    .required(),
});

// export const VCreateDiscount = Joi.object({
//   code: Joi.string().required(),
//   title: Joi.string().required(),
//   description: Joi.string().optional(),
//   type: Joi.string()
//     .valid("percentage", "fixed_amount", "buy_x_get_y", "free_shipping")
//     .required(),
//   value: Joi.string().required(),

//   status: Joi.string()
//     .valid("active", "scheduled", "expired", "disabled")
//     .optional(),
//   usage_limit: Joi.number().optional(),

//   per_customer_limit: Joi.number().optional(),
//   minimum_purchase_amount: Joi.number().optional(),

//   starts_at: Joi.string().required(),
//   ends_at: Joi.string().required(),

//   conditions: Joi.array().items(
//     Joi.object({
//       condition_type: Joi.string()
//         .valid("product", "collection", "customer_segment", "customer_tag")
//         .required(),
//       operator: Joi.string().valid("includes", "excludes").required(),
//       target_ids: Joi.array().items(Joi.string()).required(),
//     })
//   ),

//   //this thing is not using in the version in future versinon ths bugy_rule condition will allow
//   bxgy_rule: Joi.object({
//     buy_quantity: Joi.number().required(),
//     buy_product_ids: Joi.array().items(Joi.string()),
//     get_quantity: Joi.number().required(),
//     get_product_ids: Joi.array().items(Joi.string()).required(),
//     discount_value: Joi.number().required(),
//   }).optional(),
// });
