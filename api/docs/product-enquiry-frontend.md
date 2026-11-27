# Product Enquiry API — Frontend Integration Guide

Customers can now send an enquiry about a product category: name, phone, enquiry type
(Bulk Order or Custom FRP Mould), category, quantity and a message. It is a separate form from the contact form (`/api/v1/website/enquiry`) and is
stored separately. Staff see these enquiries in the CMS under **Inquiries → Product Enquiry**,
and each one is also emailed to the addresses in `SEND_ENQUIRY_TO_EMAIL`.

The storefront only needs to build the form and post it.

**Base URL:** `process.env.NEXT_PUBLIC_API_BASE_URL`
**Auth:** none. Guests and logged-in customers can both submit. Use `postRequest` from
`lib/fetcher.tsx`, the same as `ContactUsForm.tsx`.

---

## 1. Endpoints

| # | Method | Path | What it does |
|---|--------|------|--------------|
| 1 | GET | `/api/v1/products/category?page=1&limit=-1` | Categories for the dropdown (existing endpoint) |
| 2 | POST | `/api/v1/website/product-enquiry` | Submit an enquiry |

The other `/product-enquiry` routes (list, status, delete) are CMS-only and answer 403
without a staff token.

---

### 1. Categories for the dropdown

```
GET /api/v1/products/category?page=1&limit=-1
```

`limit=-1` returns every category in one response; the public response only includes
categories visible on the shop. Use `id` as the option value and `name` as the label:

```json
{
  "statusCode": 200,
  "message": "...",
  "success": true,
  "data": [
    { "id": 1, "name": "Terracotta Pots", "slug": "terracotta-pots", "...": "..." },
    { "id": 2, "name": "Wall Hangings", "slug": "wall-hangings", "...": "..." }
  ]
}
```

If the form sits on a category or product page, pre-select that page's category.

### 2. Submit an enquiry

```
POST /api/v1/website/product-enquiry
Content-Type: application/json
```

```json
{
  "name": "Riya Sen",
  "phone": "+91 98765 43210",
  "enquiry_type": "bulk_order",
  "category_id": 1,
  "quantity": "50 pieces",
  "message": "Need these for a wedding in December. Can you deliver to Salt Lake?"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | yes | Up to 120 characters |
| `phone` | string | yes | An Indian mobile number. `9876543210`, `+91 98765-43210` and `09876543210` are all accepted; it is stored as the 10 digits |
| `enquiry_type` | string | yes | `"bulk_order"` (label: Bulk Order) or `"custom_frp_mould"` (label: Custom FRP Mould). Send the value, show the label |
| `category_id` | number | yes | `id` of a category from the dropdown |
| `quantity` | string | no | Free text, up to 100 characters, e.g. `"50 pieces"`, `"2 cartons"` |
| `message` | string | no | Up to 2000 characters. Line breaks are kept |

Send only these fields: anything else (for example `status`) is refused with a 400. Empty
strings for `quantity` and `message` are stored as "not given".

**Success — 201**

```json
{
  "statusCode": 201,
  "message": "Thank you! We have received your enquiry and will contact you soon.",
  "success": true,
  "data": null,
  "key": [],
  "totalPage": 0
}
```

Show `message` to the customer and clear the form.

**Errors**

| Status | When | `message` |
|--------|------|-----------|
| 400 | Phone is not a valid Indian mobile number | `Please enter a valid 10-digit mobile number` (`key: ["phone"]`) |
| 400 | `enquiry_type` is not one of the two values | `Please choose Bulk Order or Custom FRP Mould` |
| 400 | `category_id` doesn't exist | `Please choose a valid product category` (`key: ["category_id"]`) |
| 400 | A required field is missing or too long | e.g. `"Name" is required` |
| 429 | More than 5 enquiries from one IP within an hour | `You have sent several enquiries already. Please try again later.` |

Every error message is written for the customer, so show `error.response.data.message` as
it is. `key` names the field when there is one, so you can highlight it.

---

## 2. Example form

`Component1/ProductEnquiryForm.tsx`, following `ContactUsForm.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getRequest, postRequest } from "@/lib/fetcher";

interface Category {
  id: number;
  name: string;
}

const ENQUIRY_TYPES = [
  { value: "bulk_order", label: "Bulk Order" },
  { value: "custom_frp_mould", label: "Custom FRP Mould" },
];

const EMPTY = { name: "", phone: "", enquiry_type: "", category_id: "", quantity: "", message: "" };

export default function ProductEnquiryForm({ categoryId }: { categoryId?: number }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ ...EMPTY, category_id: categoryId?.toString() ?? "" });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getRequest<{ data: Category[] }>("/api/v1/products/category?page=1&limit=-1")
      .then((res) => setCategories(res.data ?? []))
      .catch(() => setCategories([]));
  }, []);

  const set = (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus(null);
    try {
      const res = await postRequest<{ message: string }>({
        url: "/api/v1/website/product-enquiry",
        body: { ...form, category_id: Number(form.category_id) },
      });
      setStatus({ ok: true, text: res.message });
      setForm({ ...EMPTY, category_id: form.category_id });
    } catch (error: any) {
      setStatus({
        ok: false,
        text: error?.response?.data?.message ?? "Could not send your enquiry. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input required maxLength={120} placeholder="Name" value={form.name} onChange={set("name")} />
      <input required type="tel" inputMode="tel" placeholder="Mobile number" value={form.phone} onChange={set("phone")} />
      <select required value={form.enquiry_type} onChange={set("enquiry_type")}>
        <option value="" disabled>Enquiry type</option>
        {ENQUIRY_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <select required value={form.category_id} onChange={set("category_id")}>
        <option value="" disabled>Product category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <input maxLength={100} placeholder="Quantity (e.g. 50 pieces)" value={form.quantity} onChange={set("quantity")} />
      <textarea maxLength={2000} placeholder="Message" value={form.message} onChange={set("message")} />

      {status && <p className={status.ok ? "text-green-700" : "text-red-600"}>{status.text}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send enquiry"}
      </button>
    </form>
  );
}
```

Styling is left to you; match the contact form's inputs.

---

## 3. Other change: the contact-form list is now private

`GET /api/v1/website/enquiry` used to be public, so anyone could download every customer's
name, email and phone. It now needs a staff login with the Inquiries permission. The
storefront only ever posts to that path, so nothing changes for `ContactUsForm.tsx`.

---

## 4. Quick checklist

- [ ] Build the form with name, mobile number, enquiry type, product category, quantity and message
- [ ] Send `enquiry_type` as `"bulk_order"` or `"custom_frp_mould"`, not the label
- [ ] Load the categories from `/api/v1/products/category?page=1&limit=-1`; pre-select the
      page's category when the form is on a category or product page
- [ ] Post `category_id` as a number, and only the six fields in the table
- [ ] Show the API's `message` on success and on every error, including the 429 limit
- [ ] Use `type="tel"` for the phone; the API accepts `+91`, `0` and spaces, so don't
      pre-format it
