import { PoolConfig } from "pg";
import { pool } from "..";
import { encrypt } from "../services/crypto";

export function configDb() {
  const dbConfig: PoolConfig = {
    connectionString: process.env.POSTGRES_URL,
    ssl: false,
  };
  return dbConfig;
}

export async function createAdminUser() {
  // This function can be used to create an admin user in the database if needed.
  // You can implement the logic to insert an admin user into the database here.

  const encodedPassword = encrypt(process.env.ADMIN_PASSWORD || "admin123");
  const adminName = process.env.ADMIN_NAME || "Admin";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@gmail.com";
  const adminMobile = process.env.ADMIN_MOBILE || "7412589635";

  const query = `
    INSERT INTO users 
      (name, email, phone_no, password, is_verified, role) 
    VALUES 
    ($1, $2, $3, $4, $5, $6)
    ON CONFLICT(email) DO NOTHING
    RETURNING id;
  `;
  const { rowCount, rows } = await pool.query(query, [
    adminName,
    adminEmail,
    adminMobile,
    encodedPassword,
    true,
    "Admin",
  ]);

  if (rowCount !== 0) {
    console.log(`Admin user created with email: ${adminEmail}`);
    const adminId = rows[0].id;
    // You can perform additional actions with the adminId if needed
    await pool.query(
      `
       INSERT INTO user_permissions (user_id, permissions)
        VALUES
        ($1, '{
          "1-1": "r-w",
          "1-2": "r-w",
          "1-3": "r-w",
          "1-4": "r-w",
          "1-5": "r-w",
          "1-6": "r-w",
          "1-7": "r-w",
          "1-8": "r-w",
          "1-9": "r-w",
          "1-10": "r-w",
          "1-11": "r-w",
          "1-12": "r-w",
          "1-13": "r-w",
          "1-14": "r-w"
        }')
        ON CONFLICT (user_id) DO UPDATE SET permissions = EXCLUDED.permissions;
    `,
      [adminId],
    );
  } else {
    console.log(`Admin user with email ${adminEmail} already exists.`);
  }
}
