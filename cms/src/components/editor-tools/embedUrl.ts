import Embed from "@editorjs/embed";

/**
 * Turns a pasted video url into the block data the embed tool expects.
 *
 * The embed tool is built around pasting: dropping a url on an empty line is
 * what fills a block in. Inserted from a button it gets no url at all, and its
 * render() returns an empty div for data with no service — a dead block. So
 * the toolbar resolves the url first and inserts a block that already has
 * something in it.
 *
 * The patterns come from Embed.services, the tool's own table, rather than
 * being written again here: a url the paste path accepts is then exactly a url
 * the button accepts.
 */

export interface IEmbedData {
  service: string;
  source: string;
  embed: string;
  width?: number;
  height?: number;
  caption?: string;
}

export const resolveEmbed = (url: string): IEmbedData | null => {
  const source = url.trim();
  if (source === "") return null;

  // populated by the tool's static prepare(), which EditorJS runs while it
  // boots, so this is filled by the time any button can be clicked
  const services = Embed.services ?? {};

  for (const [service, config] of Object.entries(services)) {
    if (!config?.regex || !config.embedUrl) continue;

    const match = config.regex.exec(source);
    if (!match) continue;

    const groups = match.slice(1);
    const remoteId = config.id ? config.id(groups) : groups[0];
    if (!remoteId) continue;

    return {
      service,
      source,
      embed: config.embedUrl.replace(/<%= remote_id %>/g, remoteId),
      width: config.width,
      height: config.height,
    };
  }

  return null;
};
