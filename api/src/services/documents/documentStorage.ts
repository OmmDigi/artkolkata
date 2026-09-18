import { ErrorHandler } from "../../utils/ErrorHandler";
import logger from "../../utils/logger";

// Generated documents go to the upload server's PRIVATE area, never to the
// public uploads folder: an invoice carries a customer's name, address and
// phone number, and a public path is a guessable one. Everything below is the
// api's side of that — it is the only thing holding the access token, so a
// document always reaches a person through an api route that checked who they
// are first.
const DOCUMENT_FOLDER = "order-documents";

const uploadBase = () => {
  const base = process.env.UPLOAD_LOCAL_BASE_API;
  if (!base)
    throw new ErrorHandler(500, "Document storage is not configured (UPLOAD_LOCAL_BASE_API)");
  return base.replace(/\/+$/, "");
};

const accessToken = () => {
  const token = process.env.PRIVATE_FILE_ACCESS_TOKEN;
  if (!token)
    throw new ErrorHandler(
      500,
      "Document storage is not configured (PRIVATE_FILE_ACCESS_TOKEN)",
    );
  return token;
};

/**
 * Pushes a rendered PDF to the upload server and answers with the stored path
 * (`/private/order-documents/invoice-INV-100001-1737030000000.pdf`), which is
 * what goes in the orders row.
 *
 * The timestamp in the name is not decoration: the upload server never
 * overwrites, it appends its own suffix, so a regenerate always lands on a new
 * file and the old one is deleted by the caller once the new path is safely
 * stored.
 */
export const uploadOrderDocument = async (
  pdf: Buffer,
  fileName: string,
): Promise<string> => {
  const form = new FormData();
  form.set("folder", DOCUMENT_FOLDER);
  form.set("access", "private");
  form.append(
    "file",
    new Blob([new Uint8Array(pdf)], { type: "application/pdf" }),
    fileName,
  );

  const response = await fetch(`${uploadBase()}/api/v1/upload/single`, {
    method: "POST",
    body: form,
  });

  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    data?: { url?: string; pathname?: string };
  } | null;

  if (!response.ok || !payload?.data?.url) {
    throw new ErrorHandler(
      502,
      payload?.message ?? "The upload server refused the generated document",
    );
  }

  return payload.data.url;
};

/** Reads a stored document back so an api route can stream it to an admin. */
export const fetchOrderDocument = async (storedUrl: string): Promise<Buffer> => {
  const response = await fetch(
    `${uploadBase()}/api/v1/view${storedUrl.startsWith("/") ? "" : "/"}${storedUrl}`,
    { headers: { authorization: `Bearer ${accessToken()}` } },
  );

  if (!response.ok)
    throw new ErrorHandler(
      response.status === 404 ? 404 : 502,
      response.status === 404
        ? "The generated document is no longer on the storage server. Generate it again."
        : "Could not read the generated document from the storage server",
    );

  return Buffer.from(await response.arrayBuffer());
};

/**
 * Removes a superseded document. Deliberately never throws: the new document is
 * already stored and linked by the time this runs, and failing the admin's
 * request over a leftover file on disk would be the worse outcome.
 */
export const deleteOrderDocument = async (storedUrl: string) => {
  try {
    const response = await fetch(
      `${uploadBase()}/api/v1/manage/delete?url=${encodeURIComponent(storedUrl)}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${accessToken()}` },
      },
    );

    if (!response.ok)
      logger.warn("Could not delete the superseded order document", {
        storedUrl,
        status: response.status,
      });
  } catch (error) {
    logger.warn("Could not delete the superseded order document", {
      storedUrl,
      error,
    });
  }
};
