import { DatabaseError, PoolClient } from "pg";
import { pool } from "..";
import { ErrorHandler } from "./ErrorHandler";
import { IError } from "../types";

export const doTransition = async (
  cb: (client: PoolClient) => Promise<void>,
  pgClient?: PoolClient
) => {
  const client = pgClient ?? (await pool.connect());

  if (pgClient) {
    await cb(client);
    return;
  }

  try {
    await client.query("BEGIN");
    await cb(client);
    await client.query("COMMIT");
  } catch (e: any) {
    await client.query("ROLLBACK");
    const err = e as IError;
    if (err.isOperational) {
      throw err;
    }

    const dbError = e as DatabaseError;
    if (dbError.code === "23505" && dbError.detail?.includes("slug")) {
      throw new ErrorHandler(
        400,
        `Slug is already in use. Please choose a different one`
      );
    }

    console.log("Transition Error : ", err);

    throw new ErrorHandler(500, err.message);
  } finally {
    client.release();
  }
};
