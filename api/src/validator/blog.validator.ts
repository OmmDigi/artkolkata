import Joi from "joi";

// One piece of blog media. "image" is an uploaded image, "video" is a link
// (YouTube) that the website embeds — the url lives in the image field either
// way, the same shape product_images uses.
const VBlogMedia = Joi.object({
  image: Joi.string().required(),
  alt_tag: Joi.string().allow("", null).optional(),
  type: Joi.string().valid("image", "video").default("image"),
});

// Fields shared by create and update. published_at is what makes a post
// scheduled: a date in the future on a published post keeps it hidden until
// that moment arrives, checked on every read.
const blogFields = {
  title: Joi.string().required(),
  slug: Joi.string().required(),
  excerpt: Joi.string().allow("", null).optional(),
  content_json: Joi.object().required(),
  cover_image: Joi.string().allow("", null).optional(),
  cover_image_alt: Joi.string().allow("", null).optional(),
  media: Joi.array().items(VBlogMedia).default([]),
  tags: Joi.string().allow("", null).optional(),
  status: Joi.string().valid("draft", "published").default("draft"),
  published_at: Joi.date().iso().allow(null, "").optional(),
  blog_author_id: Joi.number().allow(null, "").optional(),
  meta_title: Joi.string().allow("", null).optional(),
  meta_description: Joi.string().allow("", null).optional(),
  og_title: Joi.string().allow("", null).optional(),
  og_description: Joi.string().allow("", null).optional(),
  og_image: Joi.string().allow("", null).optional(),
  og_type: Joi.string().allow("", null).optional(),
  canonical_url: Joi.string().allow("", null).optional(),
  twitter_card: Joi.string()
    .valid("summary", "summary_large_image", "app", "player")
    .allow("", null)
    .optional(),
  twitter_title: Joi.string().allow("", null).optional(),
  twitter_description: Joi.string().allow("", null).optional(),
  twitter_image: Joi.string().allow("", null).optional(),
};

export const VCreateBlog = Joi.object(blogFields);

export const VUpdateBlog = Joi.object({
  id: Joi.number().required(),
  ...blogFields,
});

export const VCreateBlogAuthor = Joi.object({
  name: Joi.string().max(120).required(),
  designation: Joi.string().allow("", null).optional(),
  bio: Joi.string().allow("", null).optional(),
  image: Joi.string().allow("", null).optional(),
  email: Joi.string().email({ tlds: false }).allow("", null).optional(),
  website_url: Joi.string().allow("", null).optional(),
});

export const VUpdateBlogAuthor = Joi.object({
  id: Joi.number().required(),
  name: Joi.string().max(120).required(),
  designation: Joi.string().allow("", null).optional(),
  bio: Joi.string().allow("", null).optional(),
  image: Joi.string().allow("", null).optional(),
  email: Joi.string().email({ tlds: false }).allow("", null).optional(),
  website_url: Joi.string().allow("", null).optional(),
});
