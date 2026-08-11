# Customer Address API

Base URL: `{HOST}/api/v1`
All request/response bodies are JSON (`Content-Type: application/json`).

---

## Auth

Every address endpoint requires a logged-in user.

Token is read in this order by [getAuthToken.ts](../src/utils/getAuthToken.ts):

1. `Authorization` header — `Bearer <token>` or the raw token
2. Cookie `refreshToken`

The token comes from `POST /api/v1/users/login` (field `refreshToken` in `data`) or the Google OAuth flow. Cookie-based calls need `credentials: "include"` on fetch/axios.

```
Authorization: Bearer eyJhbGciOi...
```

---

## Standard response envelope

Every response (success and error) uses the same shape ([httpResponse.ts](../src/utils/httpResponse.ts)):

```json
{
  "statusCode": 200,
  "message": "Address successfully saved",
  "success": true,
  "data": null,
  "key": [],
  "totalPage": 0
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `statusCode` | number | Same as HTTP status |
| `message` | string | Human-readable; validation errors come back here verbatim (Joi message) |
| `success` | boolean | `statusCode < 400` |
| `data` | any \| null | Payload; `null` on write endpoints |
| `key` | string[] | Field keys tied to the error (usually empty) |
| `totalPage` | number | Pagination; `0` here |

---

## 1. List addresses — `GET /users/profile`

There is no dedicated address-list endpoint. Addresses come back on the profile payload as `user_address`.

**Request:** no body. Auth required.

**Response 200**

```json
{
  "statusCode": 200,
  "message": "Singe Users info",
  "success": true,
  "data": {
    "id": 12,
    "name": "Somnath Gupta",
    "email": "user@example.com",
    "phone_no": "9800000000",
    "password": "plain-text-decrypted",
    "is_verified": true,
    "is_active": true,
    "role": "User",
    "permissions": null,
    "user_address": [
      {
        "address_id": 41,
        "user_id": 12,
        "name": "Somnath Gupta",
        "phone": "9800000000",
        "email": "user@example.com",
        "address_line1": "12B Park Street, Flat 3A",
        "address_line2": "12B Park Street, Flat 3A",
        "city": "Kolkata",
        "state": "West Bengal",
        "pincode": "700016",
        "landmark": null,
        "address_type": "HOME",
        "created_at": "2026-08-01T10:22:11.000Z"
      }
    ]
  },
  "key": [],
  "totalPage": 0
}
```

`user_address` is `[]` when the user has none. Sorted `address_id DESC` (newest first).

**Errors:** `401 Unauthorized`, `404 User not found`.

> Note for frontend: `password` is returned decrypted on this endpoint. Do not render or log it.

---

## 2. Add address — `POST /users/my-address`

Creates when `address_id` is absent.

**Body**

```json
{
  "fullName": "Somnath Gupta",
  "email": "user@example.com",
  "phone": "9800000000",
  "address": "12B Park Street, Flat 3A",
  "city": "Kolkata",
  "state": "West Bengal",
  "pincode": "700016",
  "country": "India"
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `fullName` | string | yes | Stored as `addresses.name` |
| `email` | string | yes | Not format-validated |
| `phone` | string | yes | Send as string, not number |
| `address` | string | yes | Full street line |
| `city` | string | yes | |
| `state` | string | yes | |
| `pincode` | string | yes | String, keeps leading zeros |
| `country` | string | yes | Required by the validator but **not persisted** |
| `address_id` | number | no | Omit to create; send to update (see §3) |
| `user_id` | number | no | Admin-only use; on `/my-address` leave it out — the id from the token is used when absent |

Unknown extra keys are rejected by Joi with `400 "xyz" is not allowed`.

**Response 201**

```json
{ "statusCode": 201, "message": "Address successfully created", "success": true, "data": null, "key": [], "totalPage": 0 }
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `"phone" is required` (Joi text) | Missing/invalid field |
| 401 | `Unauthorized` | Missing/expired token |
| 404 | `Invalid user id` | Token user not found or not role `User` |

---

## 3. Update address — `POST /users/my-address`

Same endpoint and same body as add — include `address_id` to update instead of insert.

**Body**

```json
{
  "address_id": 41,
  "fullName": "Somnath Gupta",
  "email": "user@example.com",
  "phone": "9800000000",
  "address": "12B Park Street, Flat 3A",
  "city": "Kolkata",
  "state": "West Bengal",
  "pincode": "700016",
  "country": "India"
}
```

All the §2 fields stay required — this is a full replace, not a patch. Send the whole address object back, not just the changed key.

The update is scoped to `address_id = ? AND user_id = <token user>`, so one user cannot edit another user's address.

**Response 200**

```json
{ "statusCode": 200, "message": "Address successfully saved", "success": true, "data": null, "key": [], "totalPage": 0 }
```

> Known behaviour: the update path does not check the affected row count. A bad `address_id` still returns `200 Address successfully saved` while changing nothing. Re-fetch `/users/profile` after saving if the UI needs certainty.

---

## 4. Delete address — `DELETE /users/my-address`

Body is required on a DELETE here — configure axios with `{ data: {...} }`.

**Body**

```json
{ "address_id": 41 }
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `address_id` | number | yes | Address to remove |
| `user_id` | number | no | Admin-only; ignored in practice on `/my-address`, token user wins when absent |

**Response 200**

```json
{ "statusCode": 200, "message": "Address successfully removed", "success": true, "data": null, "key": [], "totalPage": 0 }
```

**Errors**

| Status | Message | Cause |
| --- | --- | --- |
| 400 | `Unable to delete user address` | Wrong `address_id`, or address belongs to another user |
| 401 | `Unauthorized` | Missing/expired token |

---

## Admin variants (same schemas)

Permission-gated instead of plain login; the bodies are identical, plus `user_id` to target the customer.

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| POST | `/users/address` | `1-11` | Add/update address of a `User` |
| DELETE | `/users/address` | `1-11` | Delete address of a `User` |
| POST | `/users/employee/address` | `1-12` | Add/update address of an `Employee` |
| DELETE | `/users/employee/address` | `1-12` | Delete address of an `Employee` |
| GET | `/users/:id` | `1-11` | Single user + `user_address[]` |
| GET | `/users/employee/:id` | `1-12` | Single employee + `user_address[]` |

On these, `user_id` in the body selects the target user. Without it the API falls back to the token's own user id. Missing permission → `403 Forbidden`.

---

## Quirks the frontend should know

1. **Add and update share one endpoint.** Presence of `address_id` is the switch.
2. **`country` is required but dropped.** Send it (validation fails otherwise); do not expect it back in `user_address`.
3. **`address_line1` and `address_line2` are written with the same value** — the single `address` field maps to both columns. Read `address_line1` and ignore `address_line2`.
4. **`landmark` and `address_type` exist in the table** but no endpoint sets them. `address_type` defaults to `"HOME"`, `landmark` stays `null`.
5. **No default-address flag.** No column, no endpoint. Pick a default client-side (e.g. first item, newest) if the UI needs one.
6. **Update returns 200 even on no-op.** See §3.
7. **`pincode` and `phone` are strings**, both in requests and responses.

---

## cURL reference

```bash
# list
curl -X GET "$HOST/api/v1/users/profile" \
  -H "Authorization: Bearer $TOKEN"

# add
curl -X POST "$HOST/api/v1/users/my-address" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Somnath Gupta","email":"user@example.com","phone":"9800000000","address":"12B Park Street, Flat 3A","city":"Kolkata","state":"West Bengal","pincode":"700016","country":"India"}'

# update
curl -X POST "$HOST/api/v1/users/my-address" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"address_id":41,"fullName":"Somnath Gupta","email":"user@example.com","phone":"9800000000","address":"12B Park Street, Flat 3A","city":"Kolkata","state":"West Bengal","pincode":"700016","country":"India"}'

# delete
curl -X DELETE "$HOST/api/v1/users/my-address" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"address_id":41}'
```

## TypeScript types

```ts
export interface AddressPayload {
  address_id?: number; // omit = create, present = update
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string; // required by API, not stored
}

export interface Address {
  address_id: number;
  user_id: number;
  name: string;
  phone: string;
  email: string;
  address_line1: string;
  address_line2: string; // mirrors address_line1
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
  address_type: string; // "HOME"
  created_at: string;
}

export interface ApiResponse<T = null> {
  statusCode: number;
  message: string;
  success: boolean;
  data: T;
  key: string[];
  totalPage: number;
}
```
