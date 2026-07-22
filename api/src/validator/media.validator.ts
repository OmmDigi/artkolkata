import Joi from "joi";

export const VCreateMediaItem = Joi.array().items(
  Joi.object({
    media_type: Joi.string()
      .valid("image", "youtube-link")
      .required(),
    item_link: Joi.string().required(),
    alt_tag: Joi.string().required().allow(""),
  })
);

export const VUpdateMediaItem = Joi.object({
  media_item_id: Joi.number().required(),
  media_type: Joi.string()
    .valid("image", "youtube-link")
    .required(),
  item_link: Joi.string().required(),
  alt_tag: Joi.string().required(),
});

export const VSingleMediaItem = Joi.object({
  media_item_id: Joi.number().required(),
});
