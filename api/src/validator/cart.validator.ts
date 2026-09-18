import Joi from "joi";

// A cart line never holds more than this. The number is a sanity bound against
// a scripted request, not a stock check : stock is verified when the order is
// placed, because what is available can change while the cart sits there.
export const CART_MAX_QUANTITY = 99;

const productId = Joi.number().integer().positive().required();

// null is meaningful : it is how a product sold without options is stored,
// so it has to be accepted rather than stripped.
const variantId = Joi.number().integer().positive().allow(null).default(null);

export const VAddToCart = Joi.object({
  product_id: productId,
  variant_id: variantId,
  quantity: Joi.number()
    .integer()
    .min(1)
    .max(CART_MAX_QUANTITY)
    .default(1),
});

export const VUpdateCartItem = Joi.object({
  product_id: productId,
  variant_id: variantId,
  // 0 removes the line, which is what the minus button sends on the last unit
  quantity: Joi.number().integer().min(0).max(CART_MAX_QUANTITY).required(),
});

export const VRemoveCartItem = Joi.object({
  product_id: productId,
  variant_id: variantId,
});

// the guest cart handed over at login
export const VMergeCart = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        product_id: productId,
        variant_id: variantId,
        quantity: Joi.number()
          .integer()
          .min(1)
          .max(CART_MAX_QUANTITY)
          .default(1),
      }),
    )
    .max(100)
    .required(),
});
