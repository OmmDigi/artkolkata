import Joi from "joi";

/**
 * The body of a policy page as the CMS editor produces it: Editor.js
 * OutputData. The blocks are not inspected here — the editor owns that shape
 * and the website renders whatever it wrote — but the envelope is checked so a
 * malformed save cannot store something the renderer will choke on.
 */
const VContentJson = Joi.object({
  time: Joi.number().optional(),
  version: Joi.string().allow("", null).optional(),
  blocks: Joi.array().items(Joi.object().unknown(true)).default([]),
})
  .unknown(true)
  .allow(null)
  .default({ blocks: [] })
  .label("Content");

/**
 * Only the content of a page is editable. The slug is the handle the storefront
 * links to and the title identifies the page in the CMS, so neither is taken
 * from the request — the row already exists and the route names it by slug.
 */
export const VUpdateSitePage = Joi.object({
  content_json: VContentJson,

  meta_title: Joi.string().allow("", null).default("").label("Meta title"),
  meta_description: Joi.string()
    .allow("", null)
    .default("")
    .label("Meta description"),

  // 'draft' takes the body off the storefront while a rewrite is in progress
  status: Joi.string().valid("draft", "published").default("published"),
});
