import Joi from "joi";

// Fields shared by create and update. position is left out on purpose: the
// order only changes through /videos/reorder, so saving one video from the
// edit dialog can never undo a drag the admin just made in the list.
const videoFields = {
  title: Joi.string().trim().max(150).required().label("Title"),
  description: Joi.string()
    .trim()
    .max(500)
    .allow("", null)
    .optional()
    .label("Description"),
  source_type: Joi.string()
    .valid("upload", "youtube")
    .required()
    .label("Video source"),
  // the uploaded file's path, or the YouTube link as the admin pasted it
  video_url: Joi.string().trim().required().label("Video"),
  thumbnail_url: Joi.string().trim().allow("", null).optional().label("Thumbnail"),
  is_primary: Joi.boolean().default(false),
  is_active: Joi.boolean().default(true),
};

export const VCreateVideo = Joi.object(videoFields);

export const VUpdateVideo = Joi.object({
  id: Joi.number().integer().required(),
  ...videoFields,
});

export const VVideoId = Joi.object({
  id: Joi.number().integer().required(),
});

export const VReorderVideos = Joi.object({
  videos: Joi.array()
    .items(
      Joi.object({
        id: Joi.number().integer().required(),
        position: Joi.number().integer().min(0).required(),
      }),
    )
    .min(1)
    .required(),
});
