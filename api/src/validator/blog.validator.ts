import Joi from "joi";

export const VCreateBlog = Joi.object({
  title: Joi.string().required(),
  slug: Joi.string().required(),
  excerpt: Joi.string().allow("", null).optional(),
  content_json: Joi.object().required(),
  cover_image: Joi.string().allow("", null).optional(),
  cover_image_alt: Joi.string().allow("", null).optional(),
  tags: Joi.string().allow("", null).optional(),
  status: Joi.string().valid("draft", "published").default("draft"),
  meta_title: Joi.string().allow("", null).optional(),
  meta_description: Joi.string().allow("", null).optional(),
});

export const VUpdateBlog = Joi.object({
  id: Joi.number().required(),
  title: Joi.string().required(),
  slug: Joi.string().required(),
  excerpt: Joi.string().allow("", null).optional(),
  content_json: Joi.object().required(),
  cover_image: Joi.string().allow("", null).optional(),
  cover_image_alt: Joi.string().allow("", null).optional(),
  tags: Joi.string().allow("", null).optional(),
  status: Joi.string().valid("draft", "published").default("draft"),
  meta_title: Joi.string().allow("", null).optional(),
  meta_description: Joi.string().allow("", null).optional(),
});
