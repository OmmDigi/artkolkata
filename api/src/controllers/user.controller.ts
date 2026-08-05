import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import {
  VLogin,
  VResendOtp,
  VSaveUserAddress,
  VSaveUserInfo,
  VSaveUserPermissions,
  VSignUp,
  VValidateOtp,
} from "../validator/user.validator";
import {
  CustomRequest,
  IGAuth,
  IGAuthProfile,
  ISaveAddress,
  SaveUserInfo,
  SignupType,
} from "../types";
import { doValidate } from "../utils/doValidate";
import { pool } from "..";
import { decrypt, encrypt } from "../services/crypto";
import { ErrorHandler } from "../utils/ErrorHandler";
import {
  COOKIE_KEY,
  ONLINE_PAYMENT,
  ORDER_CONFIRMED,
  ORDER_DELIVERED,
  ORDER_PENDING,
  ORDER_SHIPPED,
} from "../constant";
import { createToken } from "../services/jwt";
import { sendEmail } from "../utils/sendEmail";
import { doTransition } from "../utils/doTransition";
import { insertOtpToDatabase } from "../services/users.service";
import { createOtp } from "../utils/createOtp";
import { parsePagination } from "../utils/parsePagination";
import { checkPermission } from "../utils/checkPermissions";

// normal login system
export const signUp = asyncErrorHandler(async (req, res) => {
  const value = doValidate<SignupType>(VSignUp, req.body ?? {});

  const encodedPassword = encrypt(value.password);

  const OTP = createOtp();

  await doTransition(async (client) => {
    const { rowCount } = await client.query(
      `
        INSERT INTO users (name, email, phone_no, password)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO NOTHING
      `,
      [value.name, value.email, value.phone_no, encodedPassword],
    );
    if (rowCount == 0)
      throw new ErrorHandler(
        400,
        "Your account already exist with this email addresss",
      );

    //store otp to the db with expire date 5 minit
    await insertOtpToDatabase(value.email, OTP.toString(), client);
  });

  // send otp to the email
  sendEmail(value.email, "SIGNUP_OTP", {
    userName: value.name,
    otpCode: OTP,
    expiryMinutes: "5",
  });

  httpResponse(
    res,
    200,
    `Otp has successfully sent to this email ${value.email}`,
  );
});

export const login = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{ email: string; password: string }>(
    VLogin,
    req.body ?? {},
  );

  const { rows, rowCount } = await pool.query(
    `
    SELECT 
      users.id, password, name, role, is_verified, is_active, up.permissions
    FROM users 

    LEFT JOIN user_permissions up
    ON up.user_id = users.id

    WHERE email = $1
    `,
    [value.email],
  );

  if (rowCount == 0) throw new ErrorHandler(404, "Account does not found");

  if (rows[0].is_active == false) {
    throw new ErrorHandler(400, "Your account is disabled");
  }

  const { isError, decrypted } = decrypt(rows[0].password);
  if (isError) throw new ErrorHandler(500, "Invalid password stored");

  if (decrypted != value.password)
    throw new ErrorHandler(400, "Wrong user credential");

  const isVerified = rows[0].is_verified;
  const userName = rows[0].name;

  if (!isVerified) {
    const OTP = Math.floor(1000 + Math.random() * 9999);

    //store otp to the db with expire date 5 minit
    await insertOtpToDatabase(value.email, OTP.toString());

    // send otp to the email
    sendEmail(value.email, "SIGNUP_OTP", {
      userName,
      otpCode: OTP,
      expiryMinutes: "5",
    });
    return httpResponse(res, 301, "Check your email for otp");
  }

  const token = createToken(
    {
      id: rows[0].id,
      role: rows[0].role,
      permissions: rows[0].permissions,
    },
    {
      expiresIn: "1d",
    },
  );

  httpResponse(res, 200, "Successfully login", {
    [COOKIE_KEY]: token,
    permissions: rows[0].permissions,
  });
});

export const verifyOtp = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{ otp: string; email: string; password?: string }>(
    VValidateOtp,
    req.body ?? {},
  );

  await doTransition(async (client) => {
    const { rows, rowCount } = await client.query(
      `
      SELECT *
      FROM otps
      WHERE email = $1
        AND otp = $2
        -- AND created_at > (NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '5 minutes';
      `,
      [value.email, value.otp],
    );

    if (rowCount === 0 || rows[0].otp != value.otp)
      throw new ErrorHandler(400, "Invalid otp");

    if (value.password) {
      // if it comes with password than change the password
      const encodedPassword = encrypt(value.password);
      await client.query(
        "UPDATE users SET is_verified = 'true', password = $1 WHERE email = $2",
        [encodedPassword, value.email],
      );
    } else {
      await client.query(
        "UPDATE users SET is_verified = 'true' WHERE email = $1",
        [value.email],
      );
    }
    await client.query("DELETE FROM otps WHERE email = $1 AND otp = $2", [
      value.email,
      value.otp,
    ]);
  });

  if (value.password) {
    return httpResponse(res, 200, "Password reset successfully completed!");
  }
  httpResponse(res, 200, "Email verification successfully completed!");
});

export const sendOtp = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{ email: string }>(VResendOtp, req.body ?? {});

  const OTP = createOtp();

  const { rows } = await pool.query("SELECT name FROM users WHERE email = $1", [
    value.email,
  ]);
  if (rows.length == 0)
    throw new ErrorHandler(404, "No account found with this email");

  const userName = rows[0].name;

  // UPDATE otps
  //    SET otp = $1, created_at = NOW()
  //   WHERE email = $2
  //         AND created_at <= NOW() - INTERVAL '1 minutes'

  // need to add too manu requst security here
  const { rowCount } = await pool.query(
    `
    INSERT INTO otps (email, otp) 
      VALUES ($1, $2)
      ON CONFLICT (email) DO UPDATE
      SET 
        otp = EXCLUDED.otp,
        created_at = NOW();
    `,
    [value.email, OTP],
  );

  if (rowCount === 0)
    throw new ErrorHandler(
      400,
      "Too many resend otp request please try again after some time",
    );

  // send otp to the email
  sendEmail(value.email, "SIGNUP_OTP", {
    userName,
    otpCode: OTP,
    expiryMinutes: "5",
  });

  httpResponse(res, 200, "Otp sent successfull");
});

export const getUserList = asyncErrorHandler(async (req, res) => {
  const { TO_STRING } = parsePagination(req);

  let filter = "WHERE role != 'Admin'";
  let filterNum = 1;
  const filterValues: any[] = [];

  if (req.query.name) {
    filter += ` AND name ILIKE '%' || $${filterNum++} || '%'`;
    filterValues.push(req.query.name);
  }

  if (req.query.email) {
    filter += ` AND email = $${filterNum++}`;
    filterValues.push(req.query.email);
  }

  if (req.query.phone_no) {
    filter += ` AND phone_no = $${filterNum++}`;
    filterValues.push(req.query.phone_no);
  }

  if (req.path == "/") {
    // mean admin want to get the registered users list
    filter += ` AND role = $${filterNum++}`;
    filterValues.push("User");
  } else if (req.path == "/employee") {
    filter += ` AND role = $${filterNum++}`;
    filterValues.push("Employee");
  }

  const { rows } = await pool.query(
    `
     SELECT 
      id, 
      name, 
      email, 
      phone_no, 
      role, 
      is_verified,
      is_active
     FROM users 
     ${filter}
     ORDER BY id DESC
     ${TO_STRING}
    `,
    filterValues,
  );
  httpResponse(res, 200, "Users list", rows);
});

export const getSingleUser = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    let filter = "WHERE u.id = $1";
    let filterNum = 2;
    const filterValues: any[] = [];

    if (req.originalUrl.includes("/users/profile")) {
      // mean own user see his own profile info
      filterValues.push(req.token_info?.id);
    } else if (req.originalUrl.includes("/users/employee/")) {
      // mean from admin panle the admin try to access one employee details so the employee role should be Employee
      filter += ` AND u.role = $${filterNum++}`;
      filterValues.push(req.params.id);
      filterValues.push("Employee");
    } else if (req.originalUrl.includes("/users/")) {
      // mean form admin panel the admin try to get a single user info and the user role should be User
      filter += ` AND u.role = $${filterNum++}`;
      filterValues.push(req.params?.id);
      filterValues.push("User");
    }

    const { rows, rowCount } = await pool.query(
      `
        WITH address_table AS (
          SELECT
            a.user_id,
            COALESCE(JSON_AGG(a ORDER BY a.address_id DESC) FILTER (WHERE a.address_id IS NOT NULL), '[]'::json) AS user_address
          FROM addresses a
          GROUP BY a.user_id
        )

        SELECT 
          u.id,
          u.name,
          u.email,
          u.phone_no,
          u.password,
          u.is_verified,
          u.is_active,
          u.role,
          COALESCE(at.user_address, '[]'::json) AS user_address,
          up.permissions
        FROM users u

        LEFT JOIN address_table at
        ON at.user_id = u.id

        LEFT JOIN user_permissions up
        ON up.user_id = u.id

        ${filter};
      `,
      filterValues,
    );
    if (rowCount == 0) throw new ErrorHandler(404, "User not found");

    const decodedPassword = decrypt(rows[0].password);
    if (decodedPassword.isError)
      throw new ErrorHandler(500, "Unable to decrypt user password");

    rows[0].password = decodedPassword.decrypted;

    httpResponse(res, 200, "Singe Users info", rows[0]);
  },
);

export const saveUserInfo = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const value = doValidate<SaveUserInfo>(VSaveUserInfo, req.body ?? {});

    const encodedPassword = encrypt(value.password);

    if (value.action == "Update" && value.user_id) {
      let filter = "WHERE id = $7 AND role != 'Admin'";
      // let filterNum = 8;
      const filterValues: any[] = [value.user_id];

      if (req.path == "/save") {
        filter += ` AND users.role = 'User'`;
      } else if (req.path == "/save-employee") {
        filter += ` AND users.role = 'Employee'`;
      }

      const { rowCount } = await pool.query(
        `
        UPDATE users SET 
          name = $1, 
          phone_no = $2,
          email = $3, 
          password = $4, 
          is_verified = $5, 
          is_active = $6
        ${filter}
      `,
        [
          value.name,
          value.phone_no,
          value.email,
          encodedPassword,
          value.is_verified,
          value.is_active,
          ...filterValues,
        ],
      );

      if (rowCount == 0)
        throw new ErrorHandler(400, "Not able to update user info");

      return httpResponse(res, 200, "User info successfully saved");
    }

    let roleToStore = "";
    if (req.path == "/save") {
      roleToStore = "User";
    } else if (req.path == "/employee/save") {
      roleToStore = "Employee";
    }

    const { rowCount } = await pool.query(
      `
      INSERT INTO users 
        (name, phone_no, email, password, is_verified, is_active, role) 
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7);
      `,
      [
        value.name,
        value.phone_no,
        value.email,
        encodedPassword,
        value.is_verified,
        value.is_active,
        roleToStore,
      ],
    );

    if (rowCount == 0) throw new ErrorHandler(400, "Unable to create new user");

    httpResponse(res, 201, "New user successfuly created");
  },
);

export const saveUserAddress = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const value = doValidate<ISaveAddress>(VSaveUserAddress, req.body ?? {});

    let userid: number | undefined = undefined;
    if (value.user_id) {
      userid = value.user_id;
    } else {
      userid = req.token_info?.id;
    }

    if (value.address_id) {
      let filter = "WHERE address_id = $8 AND user_id = $9";
      // let filterNum = 10;
      // let filterValues: any[] = [value.address_id, userid];

      if (req.path == "/address" || req.path == "/my-address") {
        filter += ` AND EXISTS (SELECT true FROM users WHERE id = $9 AND role = 'User')`;
      } else if (req.path == "/employee/address") {
        filter += ` AND EXISTS (SELECT true FROM users WHERE id = $9 AND role = 'Employee')`;
      }

      await pool.query(
        `
        UPDATE addresses SET
          name = $1, phone = $2, email = $3, address_line1 = $4, address_line2 = $4,
          city = $5, state = $6, pincode = $7
        ${filter}
      `,
        [
          value.fullName,
          value.phone,
          value.email,
          value.address,
          value.city,
          value.state,
          value.pincode,
          value.address_id,
          userid,
        ],
      );
      httpResponse(res, 200, "Address successfully saved");
    } else {
      let filter = "WHERE id = $1";
      if (req.path == "/address" || req.path == "/my-address") {
        filter += " AND role = 'User'";
      } else if (req.path == "/employee/address") {
        filter += " AND role = 'Employee'";
      }

      const { rowCount } = await pool.query(
        `SELECT true FROM users ${filter}`,
        [userid],
      );
      if (rowCount == 0) throw new ErrorHandler(404, "Invalid user id");

      await pool.query(
        `
        INSERT INTO addresses 
          (name, phone, email, address_line1, address_line2, city, state, pincode, user_id) 
        VALUES 
          ($1, $2, $3, $4, $4, $5, $6, $7, $8);`,
        [
          value.fullName,
          value.phone,
          value.email,
          value.address,
          value.city,
          value.state,
          value.pincode,
          userid,
        ],
      );

      httpResponse(res, 201, "Address successfully created");
    }
  },
);

export const deleteUserAddress = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    let userid: number | undefined = undefined;

    let filter = "WHERE address_id = $1 AND user_id = $2";

    if (req.body.user_id) {
      userid = parseInt(req.body.user_id.toString());
    } else {
      userid = req.token_info?.id;
    }

    if (req.path == "/address" || req.path == "/my-address") {
      filter += ` AND EXISTS (SELECT true FROM users WHERE id = $2 AND role = 'User')`;
    } else if (req.path == "/employee/address") {
      filter += ` AND EXISTS (SELECT true FROM users WHERE id = $2 AND role = 'Employee')`;
    }

    const { rowCount } = await pool.query(`DELETE FROM addresses ${filter}`, [
      req.body.address_id,
      userid,
    ]);
    if (rowCount == 0)
      throw new ErrorHandler(400, "Unable to delete user address");

    httpResponse(res, 200, "Address successfully removed");
  },
);

export const saveUserPermission = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{ permissions: string; user_id: number }>(
    VSaveUserPermissions,
    req.body ?? {},
  );

  const parsedPermission = JSON.parse(value.permissions) as object;

  await pool.query(
    "INSERT INTO user_permissions (user_id, permissions) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET permissions = EXCLUDED.permissions",
    [value.user_id, parsedPermission],
  );

  httpResponse(res, 200, "User permission successfully saved");
});

export const checkUserLoginInfo = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const { rows, rowCount } = await pool.query(
      `
    SELECT 
      users.id, role, is_active, up.permissions
    FROM users 

    LEFT JOIN user_permissions up
    ON up.user_id = users.id

    WHERE users.id = $1
    `,
      [req.token_info?.id],
    );

    if (rowCount == 0) throw new ErrorHandler(401, "Unauthorize");

    const token = createToken(
      {
        id: rows[0].id,
        role: rows[0].role,
        permissions: rows[0].permissions,
      },
      {
        expiresIn: "1d",
      },
    );

    httpResponse(res, 200, "Yes logged in", {
      [COOKIE_KEY]: token,
      permissions: rows[0].permissions,
    });
  },
);

//login with google
export const loginWithGoogle = asyncErrorHandler(async (req, res) => {
  let state: string | null = null;

  if (req.query.redirect) {
    state = Buffer.from(
      JSON.stringify({ redirectAfterLogin: req.query.redirect }),
    ).toString("base64");
  }

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
    process.env.CLIENT_ID
  }&redirect_uri=${
    process.env.REDIRECT_URL
  }&response_type=code&scope=profile email${
    state !== null ? `&state=${encodeURIComponent(state)}` : ""
  }`;

  res.status(307).redirect(url);
});

export const verifyGoogleLogin = asyncErrorHandler(async (req, res) => {
  const { code, state } = req.query;

  let redirectAfterLogin = process.env.FRONTEND_HOST_URL;

  if (state) {
    try {
      const decoded = JSON.parse(
        Buffer.from(state.toString(), "base64").toString("utf-8"),
      );
      if (decoded.redirectAfterLogin)
        redirectAfterLogin = decoded.redirectAfterLogin;
    } catch (err) {
      console.error("Invalid state param:", err);
    }
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      code,
      redirect_uri: process.env.REDIRECT_URL,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok)
    throw new ErrorHandler(
      400,
      "Some error happened while verifying google login",
    );

  const result = await response.json();
  const { access_token } = result as IGAuth;

  const profileResponse = await fetch(
    "https://www.googleapis.com/oauth2/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${access_token}` },
    },
  );

  if (!profileResponse.ok)
    throw new ErrorHandler(
      400,
      "Some error happened while fetching user profile info",
    );

  const googleProfile = (await profileResponse.json()) as IGAuthProfile;

  const encryptPassword = encrypt(googleProfile.id);

  const { rows } = await pool.query(
    `
    INSERT INTO users 
      (name, email, phone_no, password, is_verified)
    VALUES 
      ($1, $2, $3, $4, $5)
    ON CONFLICT (email)
    DO UPDATE SET
      name = EXCLUDED.name,
      is_verified = 'true'
    RETURNING id
  `,
    [googleProfile.name, googleProfile.email, "", encryptPassword, true],
  );

  const token = createToken(
    {
      // role: rows[0].user_role,
      name: googleProfile.name,
      id: rows[0].id,
      google_oauth_access_token: access_token,
    },
    { expiresIn: "1d" },
  );

  res.redirect(redirectAfterLogin || "");
});

export const getUserOrdersList = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    let filter = "WHERE o.user_id = $1";
    // let filterNum = 2;
    const filterValues: any[] = [];
    if (
      req.query.userid &&
      checkPermission(req.token_info?.permissions ?? null, [
        "1-11",
        "1-12",
        "1-5",
      ])
    ) {
      filterValues.push(req.query.userid);
    } else {
      filterValues.push(req.token_info?.id);
    }

    const { rows } = await pool.query(
      `
     SELECT
      o.order_id,
      o.order_number,
      TO_CHAR(o.created_at, 'DD Mon YYYY') AS order_date,
      o.order_status,
      o.total_amount,
      o.payment_method,
      CASE
        WHEN o.order_status = '${ORDER_DELIVERED}' 
              AND o.payment_method = '${ONLINE_PAYMENT}' 
              AND o.updated_at >= NOW() - INTERVAL '7 days'
        THEN true
        ELSE false
      END AS is_returnable,
      CASE
        WHEN o.order_status = '${ORDER_DELIVERED}' 
              AND o.updated_at >= NOW() - INTERVAL '7 days'
        THEN true
        ELSE false
      END AS is_replaceable,
      CASE
       WHEN o.order_status = '${ORDER_DELIVERED}'
       THEN true
       ELSE false
      END AS invoice_avilable,
      o.waybill AS tracking_id,
      CASE
        WHEN o.order_status = '${ORDER_PENDING}' OR o.order_status = '${ORDER_CONFIRMED}' OR o.order_status = '${ORDER_SHIPPED}'
        THEN true
        ELSE false
      END AS is_cancelable,
      JSON_AGG(
        CASE
          WHEN oi.variant_info IS NOT NULL
          THEN JSON_BUILD_OBJECT(
          'product_name', oi.variant_info->>'product_name',
          'quantity', oi.quantity,
          'sku', oi.variant_info->>'sku',
          'price', oi.variant_info->'price',
          'images', COALESCE(
              oi.variant_info->'images'->0,
              (
                SELECT 
                  jsonb_build_object(
                    'image',   image,
                    'alt_tag', alt_tag 
                  )    
                FROM product_images

                WHERE product_id = (oi.variant_info->>'product_id')::int
                AND COALESCE(type, 'image') = 'image'
                ORDER BY position ASC
                LIMIT 1
              )
            )
          )
          ELSE JSON_BUILD_OBJECT(
          'product_name', oi.product_info->>'name',
          'quantity', oi.quantity,
          'sku', null,
          'images', oi.product_info->'images'->0,
          'price', oi.product_info->'price'
          )
        END
      ) AS ordered_products
      FROM orders o

      LEFT JOIN order_items oi
      ON oi.order_id = o.order_id

      ${filter}

      GROUP BY o.order_id

      ORDER BY o.order_id DESC
    `,
      filterValues,
    );

    httpResponse(res, 200, "User order list", rows);
  },
);
