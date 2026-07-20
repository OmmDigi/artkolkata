import Joi from "joi";

export const VAddCategory = Joi.object({
  name: Joi.string().required(),
  slug: Joi.string().required(),
  image: Joi.string().required(),
  alt_tag: Joi.string().optional(),
  position: Joi.number().integer().min(0).optional().default(0),
});

export const VUpdateCategory = Joi.object({
  id: Joi.number().required(),
  name: Joi.string().required(),
  slug: Joi.string().required(),
  image: Joi.string().required(),
  alt_tag: Joi.string().optional(),
  position: Joi.number().integer().min(0).optional().default(0),
});

export const VAddSubCategory = Joi.object({
  category_id: Joi.number().required(),
  name: Joi.string().required(),
  slug: Joi.string().required(),
  image: Joi.string().required(),
  alt_tag: Joi.string().optional(),
  position: Joi.number().integer().min(0).optional().default(0),
});

export const VUpdateSubCategory = Joi.object({
  id: Joi.number().required(),
  category_id: Joi.number().required(),
  name: Joi.string().required(),
  slug: Joi.string().required(),
  image: Joi.string().required(),
  alt_tag: Joi.string().optional(),
  position: Joi.number().integer().min(0).optional().default(0),
});

export const VAddProducts = Joi.object({
  sku_id: Joi.string().optional().label("Product Sku Id"),
  name: Joi.string().required().label("Product name"),
  position: Joi.number().integer().min(0).optional().default(0),

  slug: Joi.string().required().label("Product slug"),

  // description: Joi.string().required().label("Product description"),
  description_json : Joi.object().required().label("Product description"),
  category_id: Joi.number().required().label("Choose category"),
  sub_category_id: Joi.number().optional().label("Sub category id"),
  price: Joi.string().required(),
  compare_at_price: Joi.string().required(),
  available_quantity: Joi.number().optional(),
  meta_title: Joi.string().optional(),
  meta_description: Joi.string().optional(),
  status: Joi.number().required(),
  tags: Joi.array().items(Joi.string()).optional().default([]),

  images: Joi.array()
    .items(
      Joi.object({
        image: Joi.string().required().label("Image url"),
        alt_tag: Joi.string().optional().label("Image alt tag").allow(null),
        position: Joi.number().optional().label("Image position"),
      }),
    )
    .required()
    .label("Product images"),

  options: Joi.array().items(
    Joi.object({
      id: Joi.number().optional(),
      name: Joi.string().required(),
      values: Joi.array().items(
        Joi.object({
          id: Joi.number().optional(),
          value: Joi.string().required(),
        }),
      ),
    }),
  ),

  variants: Joi.array().items(
    Joi.object({
      id: Joi.number().optional(),
      isNew: Joi.boolean().optional(),
      combination: Joi.array().items(Joi.string()).required(),
      price: Joi.string().required(),
      compareAtPrice: Joi.string().required(),
      quantity: Joi.number().required(),
      sku: Joi.string().optional(),
      available: Joi.bool().required(),
      images: Joi.array()
        .items(
          Joi.object({
            image: Joi.string().required().label("Varient Image url"),
            alt_tag: Joi.string()
              .optional()
              .label("Varient Image alt tag")
              .allow(null),
            position: Joi.number().optional().label("Image position"),
          }),
        )
        .label("Varient images"),
    }),
  ),

  product_for: Joi.string()
    .required()
    .valid("b2b", "b2c", "both")
    .label("Product for"),
});

export const VAddSingleProduct = Joi.object({
  id: Joi.number().required(),
});

export const VUpdateProducts = Joi.object({
  id: Joi.number().required(),

  sku_id: Joi.string().optional().label("Product Sku Id"),
  name: Joi.string().required().label("Product name"),
  position: Joi.number().integer().min(0).optional().default(0),

  slug: Joi.string().required().label("Product slug"),

  // description: Joi.string().required().label("Product description"),
  description_json : Joi.object().required().label("Product description"),
  category_id: Joi.number().required().label("Choose category"),
  sub_category_id: Joi.number().optional().label("Sub category id"),
  price: Joi.string().required(),
  compare_at_price: Joi.string().required(),
  available_quantity: Joi.number().optional(),
  meta_title: Joi.string().optional(),
  meta_description: Joi.string().optional(),
  status: Joi.number().required(),
  tags: Joi.array().items(Joi.string()).optional().default([]),

  images: Joi.array()
    .items(
      Joi.object({
        image: Joi.string().required().label("Image url"),
        alt_tag: Joi.string().optional().label("Image alt tag").allow(null),
        position: Joi.number().optional().label("Image position"),
      }),
    )
    .required()
    .label("Product images"),

  options: Joi.array().items(
    Joi.object({
      id: Joi.number().optional(),
      name: Joi.string().required(),
      values: Joi.array().items(
        Joi.object({
          id: Joi.number().optional(),
          value: Joi.string().required(),
        }),
      ),
    }),
  ),

  variants: Joi.array().items(
    Joi.object({
      id: Joi.number().optional(),
      isNew: Joi.boolean().optional(),
      combination: Joi.array().items(Joi.string()).required(),
      price: Joi.string().required(),
      compareAtPrice: Joi.string().required(),
      quantity: Joi.number().required(),
      sku: Joi.string().optional(),
      available: Joi.bool().required(),
      images: Joi.array()
        .items(
          Joi.object({
            image: Joi.string().required().label("Varient Image url"),
            alt_tag: Joi.string()
              .optional()
              .label("Varient Image alt tag")
              .allow(null),
            position: Joi.number().optional().label("Image position"),
          }),
        )
        .label("Varient images"),
    }),
  ),

  product_for: Joi.string()
    .required()
    .valid("b2b", "b2c", "both")
    .label("Product for"),
});

export const VAddReview = Joi.object({
  stars: Joi.number().required().min(1).max(5),
  message: Joi.string().optional().max(500),
  product_id: Joi.number().required(),
});

export const VUpdateReviewStatus = Joi.object({
  id: Joi.number().required(),
  status: Joi.number().valid(1, 2).required(),
});

export const VDeleteReview = Joi.object({
  id: Joi.number().required(),
});

export const VAddNewRecipent = Joi.object({
  tag_name: Joi.string().required(),
  alt_tag: Joi.string().optional(),
  image: Joi.string().required(),
  status: Joi.number().required().valid(1, 2),
});

export const VUpdateRecipent = Joi.object({
  id: Joi.number().required(),
  tag_name: Joi.string().required(),
  alt_tag: Joi.string().optional(),
  image: Joi.string().required(),
  status: Joi.number().required().valid(1, 2),
});

export const VDeleteRecipent = Joi.object({
  id: Joi.number().required(),
});

export const VCopyProduct = Joi.object({
  old_product_id : Joi.number().required()
})