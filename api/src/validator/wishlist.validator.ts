import Joi from "joi";

export const VAddToWishlist = Joi.object({
  product_id: Joi.number().integer().positive().required(),
});

// the guest wishlist handed over at login
export const VMergeWishlist = Joi.object({
  product_ids: Joi.array()
    .items(Joi.number().integer().positive())
    .max(100)
    .required(),
});
