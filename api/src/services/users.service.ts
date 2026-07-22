import { PoolClient } from "pg";
import { pool } from "..";

export const insertOtpToDatabase = async (
  email: string,
  otp: string,
  client?: PoolClient
) => {
  const pgClient = client ? client : pool;
  //store otp to the db with expire date 5 minit
  await pgClient.query(
    `INSERT INTO otps 
         (email, otp) 
        VALUES ($1, $2) 
        ON CONFLICT (email)
        DO UPDATE 
         SET otp = EXCLUDED.otp,
         created_at = CURRENT_TIMESTAMP`,
    [email, otp]
  );
};
