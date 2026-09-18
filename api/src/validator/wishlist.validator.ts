import Joi from "joi";

export const VAddToWishlist = Joi.object({
  product_id: Joi.number().integer().positive().required(),
});
