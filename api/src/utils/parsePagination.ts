import { Request } from "express";

export function parsePagination(req: Request, limit?: number) {
  if (req.query.page && req.query.page == "-1") {
    return { OFFSET: "", LIMIT: "", TO_STRING: "" }
  }

  if (req.query.limit && req.query.limit == "-1") {
    return { OFFSET: "", LIMIT: "", TO_STRING: "" }
  }
  
  const reqLimit = req.query.limit?.toString();
  const LIMIT = limit || parseInt(reqLimit || "10");
  const page = parseInt((req.query.page as string) || "1");
  const OFFSET = (page - 1) * LIMIT;
  delete req.query.page;
  const TO_STRING = `LIMIT ${LIMIT} OFFSET ${OFFSET}`;
  return { OFFSET, LIMIT, TO_STRING };
}
