-- CREATE DATABASE IF NOT EXISTS trinketandcasa;

-- DROP TABLE IF EXISTS users;
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_no VARCHAR(20) NOT NULL,
    
    password TEXT,

    is_verified BOOLEAN DEFAULT false,

    UNIQUE(email)
);

-- ALTER TABLE users DROP COLUMN role;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'User';

-- DROP TABLE IF EXISTS otps;
CREATE TABLE IF NOT EXISTS otps (
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(8) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(email)
);

-- DROP TABLE IF EXISTS media_items;
-- CREATE TABLE IF NOT EXISTS media_items (
--     media_item_id SERIAL PRIMARY KEY,
--     media_type VARCHAR(255) NOT NULL,
--     item_link TEXT,
--     alt_tag VARCHAR(255)
-- );

-- DROP TABLE IF EXISTS categories;
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    slug text UNIQUE NOT NULL,

    image TEXT NOT NULL,
    alt_tag TEXT
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku_id TEXT,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,

    price DECIMAL(10, 2) DEFAULT 0.00,
    compare_at_price DECIMAL(10, 2) DEFAULT 0.00,

    available_quantity INTEGER DEFAULT 0,

    meta_title TEXT,
    meta_description TEXT,

    status INT DEFAULT 1, -- 1 Public, 2 Private

    tags TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS product_slug_unique_idx
ON products(slug);

-- Product options (Color, Size, etc.)
CREATE TABLE IF NOT EXISTS product_options (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Option values (Red, Blue, Small, Large, etc.)
CREATE TABLE IF NOT EXISTS product_option_values (
    id SERIAL PRIMARY KEY,
    option_id INTEGER REFERENCES product_options(id) ON DELETE CASCADE,
    value VARCHAR(100) NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Product variants
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    compare_at_price DECIMAL(10, 2),
    quantity INTEGER DEFAULT 0,
    available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variant_images (
    product_variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
    image TEXT,
    alt_tag TEXT
);

ALTER TABLE product_variant_images ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- media kind of the row, "image" for uploaded images and "video" for video links (the url stays in the image column)
ALTER TABLE product_variant_images ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'image';
UPDATE product_variant_images SET type = 'image' WHERE type IS NULL;

-- Variant option values (junction table)
CREATE TABLE IF NOT EXISTS variant_option_values (
    id SERIAL PRIMARY KEY,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
    option_value_id INTEGER REFERENCES product_option_values(id) ON DELETE CASCADE,
    UNIQUE(variant_id, option_value_id)
);

-- Product Images
-- DROP TABLE IF EXISTS product_images;
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  image TEXT,
  alt_tag TEXT 
);

ALTER TABLE product_images ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- media kind of the row, "image" for uploaded images and "video" for video links (the url stays in the image column)
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'image';
UPDATE product_images SET type = 'image' WHERE type IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_options_product_id ON product_options(product_id);
CREATE INDEX IF NOT EXISTS idx_product_option_values_option_id ON product_option_values(option_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variant_option_values_variant_id ON variant_option_values(variant_id);


-- CREATE TABLE IF NOT EXISTS shipping_details (
--     user_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
--     shipping_details TEXT
-- );

-- ALTER TABLE shipping_details DROP COLUMN IF EXISTS created_at;
-- ALTER TABLE shipping_details ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- CREATE TABLE IF NOT EXISTS orders (
--     id SERIAL PRIMARY KEY,
--     order_id TEXT,



--     user_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
-- )

CREATE TABLE IF NOT EXISTS discount (
    id SERIAL PRIMARY KEY,

    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,

    type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed_amount'
    value DECIMAL(10, 2), -- percentage (0-100) or fixed amount
    status VARCHAR(20) DEFAULT 'active', -- 'active' 'disabled'

    starts_at TIMESTAMP,
    ends_at TIMESTAMP
);

ALTER TABLE discount ADD COLUMN IF NOT EXISTS min_amount_to_select DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE discount ADD COLUMN IF NOT EXISTS condition_type VARCHAR(50); -- 'product', 'categories',;
ALTER TABLE discount ADD COLUMN IF NOT EXISTS target_ids TEXT;

CREATE TABLE IF NOT EXISTS sub_categories (
    id SERIAL PRIMARY KEY,

    category_id BIGINT REFERENCES categories(id) ON DELETE CASCADE,

    name text NOT NULL,
    slug text UNIQUE NOT NULL,

    image TEXT NOT NULL,
    alt_tag TEXT
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS sub_category_id BIGINT REFERENCES sub_categories(id) ON DELETE SET NULL;

ALTER TABLE discount
  ALTER COLUMN ends_at SET DATA TYPE timestamptz;
ALTER TABLE discount
  ALTER COLUMN starts_at SET DATA TYPE timestamptz;


CREATE TABLE IF NOT EXISTS addresses (
  address_id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  name VARCHAR(150),
  phone VARCHAR(20),
  email VARCHAR(120),
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city VARCHAR(120),
  state VARCHAR(120),
  pincode VARCHAR(10),
  landmark TEXT,
  address_type VARCHAR(20) DEFAULT 'HOME',  -- HOME | WORK
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  order_id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  
  order_number VARCHAR(30) UNIQUE NOT NULL, -- e.g. ORD20250117001

  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  shipping_charge NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  
  coupon_code VARCHAR(50),
  
  order_status VARCHAR(40) DEFAULT 'PENDING', 
  -- PENDING, CONFIRMED, PACKED, SHIPPED, DELIVERED, CANCELLED, RETURNED, RETURN INITIATED

  payment_status VARCHAR(40) DEFAULT 'PENDING', 
  -- PENDING, PAID, FAILED, REFUNDED

  shipping_address_id INT REFERENCES addresses(address_id),
  billing_address_id INT REFERENCES addresses(address_id),

  payment_method VARCHAR(20), -- COD, ONLINE
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_decreased BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
  variant_id INT REFERENCES product_variants(id),
  quantity INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL
);

ALTER TABLE order_items DROP COLUMN IF EXISTS variant_id;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_info JSONB;

ALTER TABLE order_items DROP COLUMN IF EXISTS product_id;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_info JSONB;

CREATE TABLE IF NOT EXISTS payments (
  payment_id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(order_id),
  provider VARCHAR(50),      -- Razorpay, Paytm, Stripe
  provider_order_id TEXT,
  provider_payment_id TEXT,
  amount NUMERIC(10,2),
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(20),        -- PENDING, PAID, FAILED, REFUNDED
  response JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,

  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  stars INT DEFAULT 1,
  message TEXT,

  status INT DEFAULT 1, --1 Mean Not Approved, 2, Approved

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS stock_decreased BOOLEAN DEFAULT false;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS waybill TEXT;
CREATE INDEX IF NOT EXISTS idx_webhook_orders ON orders(waybill);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS waybill TEXT;
CREATE INDEX IF NOT EXISTS idx_webhook_order_items ON order_items(waybill);

-- Migrate shipping address from FK to JSONB snapshot so addresses can be freely deleted
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;

-- UPDATE orders o
-- SET shipping_address = jsonb_build_object(
--   'name',         a.name,
--   'phone',        a.phone,
--   'email',        a.email,
--   'address_line1',a.address_line1,
--   'city',         a.city,
--   'state',        a.state,
--   'pincode',      a.pincode,
--   'country',      'India'
-- )
-- FROM addresses a
-- WHERE a.address_id = o.shipping_address_id
--   AND o.shipping_address IS NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_shipping_address_id_fkey;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_billing_address_id_fkey;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_address_id;
ALTER TABLE orders DROP COLUMN IF EXISTS billing_address_id;


CREATE TABLE IF NOT EXISTS webhook_data (
  id SERIAL PRIMARY KEY,
  waybill TEXT,
  payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_webhook_data_waybill ON webhook_data(waybill);
ALTER TABLE webhook_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;


CREATE TABLE IF NOT EXISTS recipient (
  id SERIAL PRIMARY KEY,
  tag_name VARCHAR(255) NOT NULL,
  image TEXT,
  alt_tag VARCHAR(100)
);

ALTER TABLE recipient ADD COLUMN IF NOT EXISTS status INT DEFAULT 1; -- 1 Public, 2 Private.

CREATE TABLE IF NOT EXISTS order_returns (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(order_id),
  waybill VARCHAR(50),
  reason TEXT,
  type VARCHAR(20), -- Return / Replace
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS product_for VARCHAR(30) DEFAULT 'b2c';

CREATE TABLE IF NOT EXISTS enquiry_form (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(30),
    message TEXT,

    business_name TEXT,
    quantity INT,

    product_id BIGINT REFERENCES products(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,

  user_id INTEGER REFERENCES users(id),
  permissions JSONB DEFAULT '{}',

  UNIQUE(user_id)
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS description_json JSONB;

CREATE TABLE IF NOT EXISTS store_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Order charges are not configurable: GST is a fixed 18% already inside the
-- product prices and delivery is never billed, so no rows are seeded here.
-- The table still backs the site info and banner settings.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_breakdown JSONB;

-- Bigship integration
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bigship_order_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_bigship_order_id ON orders(bigship_order_id);

-- Shipment box snapshot taken at placement: { weight, length, breadth, height }.
-- Frozen with the order so a later product edit cannot change what gets booked.
-- Only used to quote shipping at checkout — what actually ships is shipment_boxes.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_dimensions JSONB;

-- The real boxes, keyed in by the admin from the CMS before confirming the
-- order: [{ weight_kg, length_cm, breadth_cm, height_cm }, ...], one entry per
-- physical box. This replaces the product-derived dimensions at booking time —
-- what leaves the warehouse is packed by hand, so only the admin knows it.
-- One box books as Bigship B2C (api/order/add/single); more than one has to go
-- as a B2B heavy order (api/order/add/heavy), which B2C does not support.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_boxes JSONB;

-- Bigship demands an ewaybill on B2B shipments invoiced at 50,000 or above.
-- The document is held as a data URI (application/pdf or image/jpeg base64),
-- which is the form Bigship wants it in, so no conversion at booking time.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ewaybill_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ewaybill_document TEXT;

-- An invoice uploaded against this order from the CMS, held as a data URI the
-- same way. When present it is what the customer downloads and what a B2B
-- shipment is booked against, and the invoice the app generates itself is not
-- used at all.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_document TEXT;

-- Physical dimensions, used to calculate real shipping weight/rates via Bigship
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10, 3) DEFAULT 0.5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS length_cm DECIMAL(10, 2) DEFAULT 10;
ALTER TABLE products ADD COLUMN IF NOT EXISTS breadth_cm DECIMAL(10, 2) DEFAULT 10;
ALTER TABLE products ADD COLUMN IF NOT EXISTS height_cm DECIMAL(10, 2) DEFAULT 10;

-- Blog posts
CREATE TABLE IF NOT EXISTS blogs (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    excerpt TEXT,
    content_json JSONB,
    cover_image TEXT,
    cover_image_alt TEXT,
    tags TEXT,
    status TEXT DEFAULT 'draft',
    meta_title TEXT,
    meta_description TEXT,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blogs_slug ON blogs(slug);
CREATE INDEX IF NOT EXISTS idx_blogs_status ON blogs(status);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
ALTER TABLE sub_categories ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Migrate product tags from comma-separated TEXT to JSONB object {"tag": true}
--
-- Guarded on the column still being text. This whole file runs as one
-- statement, so it runs as one transaction: once tags is jsonb, trim(tags)
-- below is an error, and that error would roll back every migration written
-- after it — including ones that had never been applied.
DO $migrate_product_tags$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products'
      AND column_name = 'tags'
      AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS tags_jsonb JSONB DEFAULT '{}';

    UPDATE products
    SET tags_jsonb = (
      SELECT jsonb_object_agg(trim(t), true)
      FROM unnest(string_to_array(trim(tags), ',')) AS t
    )
    WHERE tags IS NOT NULL AND trim(tags) != '';

    ALTER TABLE products DROP COLUMN IF EXISTS tags;
    ALTER TABLE products RENAME COLUMN tags_jsonb TO tags;
  END IF;
END
$migrate_product_tags$;

CREATE INDEX IF NOT EXISTS idx_products_tags_gin ON products USING GIN (tags);
-- Category visibility (public / private). Private categories are only visible to admins
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_categories_is_visible ON categories(is_visible);

-- Site info (logo, contact emails/phones, addresses) stored as JSONB text values
-- inside the existing key/value store_settings table.
INSERT INTO store_settings (key, value) VALUES
  ('site_logo',       '""'),
  ('site_logo_alt',   '""'),
  ('contact_emails',  '[]'),
  ('contact_phones',  '[]'),
  ('site_addresses',  '[]'),
  ('ribbon_section',  '{"text":"","link":null}')
ON CONFLICT (key) DO NOTHING;

-- Website banners
CREATE TABLE IF NOT EXISTS site_banners (
    id SERIAL PRIMARY KEY,
    image_url TEXT NOT NULL,          -- desktop artwork, also the fallback
    mobile_image_url TEXT,            -- optional, served below 768px
    tablet_image_url TEXT,            -- optional, served between 768px and 1024px
    alt_text TEXT,
    link_url TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- responsive artwork for banner tables created before the device variants existed
ALTER TABLE site_banners ADD COLUMN IF NOT EXISTS mobile_image_url TEXT;
ALTER TABLE site_banners ADD COLUMN IF NOT EXISTS tablet_image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_site_banners_position ON site_banners(position);
CREATE INDEX IF NOT EXISTS idx_site_banners_is_active ON site_banners(is_active);

-- Automatic (no coupon code) order value discounts.
-- e.g. "spend ₹2000 or more, get 10% off (max ₹500)".
CREATE TABLE IF NOT EXISTS auto_discount_rules (
    id SERIAL PRIMARY KEY,

    title VARCHAR(255) NOT NULL,

    -- cart value (after any coupon) the order must reach for this rule to fire
    min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,

    type VARCHAR(20) NOT NULL,             -- 'percentage' | 'fixed_amount'
    value NUMERIC(10,2) NOT NULL,          -- percentage (0-100) or rupee amount
    max_discount_amount NUMERIC(10,2),     -- cap for percentage rules, NULL = uncapped

    -- when false the rule is skipped for orders that already used a coupon code
    stackable_with_coupon BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'disabled'

    -- higher priority wins when several slabs match; ties break on the bigger slab
    priority INTEGER NOT NULL DEFAULT 0,

    starts_at TIMESTAMPTZ,                 -- NULL = no start boundary
    ends_at TIMESTAMPTZ,                   -- NULL = never expires

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_discount_rules_lookup
ON auto_discount_rules(status, min_order_amount);

-- Split of the discount column so reports can tell coupon vs automatic discount apart
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_discount_rule_id INTEGER;

-- Products a user saved for later. One row per (user, product) pair, so adding
-- the same product twice is a no-op instead of a duplicate row.
CREATE TABLE IF NOT EXISTS wishlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON wishlist(product_id);

-- Shiprocket integration
-- Shiprocket returns two separate ids for one booking: an order id (what the
-- Shiprocket panel and the cancel/invoice APIs key off) and a shipment id
-- (what AWB assignment, pickup, label and manifest key off). Both are needed
-- later, so both are stored. shiprocket_order_id being set is what marks an
-- order as already booked, so it must be written even when AWB assignment fails.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_shipment_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_shiprocket_order_id ON orders(shiprocket_order_id);

-- ============================================================
-- SHIPPING PARTNER — one set of columns, whoever books the parcel
--
-- The per-partner columns above (shiprocket_order_id, bigship_order_id) are
-- what these replace: every partner now writes the same three columns, so no
-- query has to know which one is live. They are left in place, unread, so an
-- older build rolled back onto this database still finds what it wrote.
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_partner VARCHAR(20);
-- What the partner keys the booking off, and what marks an order as already
-- booked — so it is written even when AWB assignment fails.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_order_id TEXT;
-- Shiprocket keys AWB assignment, pickup, label and manifest off a second id.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_shipment_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_partner_order_id ON orders(partner_order_id);

-- Backfill from the columns they replace, so orders booked before this change
-- are still found by the cancel and re-confirm paths. Guarded on
-- partner_order_id being empty, so it cannot overwrite a newer booking.
UPDATE orders
SET shipping_partner    = 'shiprocket',
    partner_order_id    = shiprocket_order_id,
    partner_shipment_id = shiprocket_shipment_id
WHERE partner_order_id IS NULL AND shiprocket_order_id IS NOT NULL;

UPDATE orders
SET shipping_partner = 'bigship',
    partner_order_id = bigship_order_id
WHERE partner_order_id IS NULL AND bigship_order_id IS NOT NULL;

-- ============================================================
-- REVERSE SHIPMENTS — the collection, and the parcel that replaces it
--
-- A Replace has two legs: the goods come back on `waybill`, and the new parcel
-- goes out on `replacement_waybill`. They cannot share the order's own shipment
-- columns, which the original forward parcel already owns.
-- ============================================================
ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS shipping_partner VARCHAR(20);
ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS partner_order_id TEXT;
ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS partner_shipment_id TEXT;
ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS courier_name TEXT;
ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS replacement_partner_order_id TEXT;
ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS replacement_partner_shipment_id TEXT;
ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS replacement_waybill TEXT;
ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS replacement_courier_name TEXT;
ALTER TABLE order_returns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Both legs are looked up by AWB on every courier scan.
CREATE INDEX IF NOT EXISTS idx_order_returns_waybill ON order_returns(waybill);
CREATE INDEX IF NOT EXISTS idx_order_returns_replacement_waybill
  ON order_returns(replacement_waybill);
CREATE INDEX IF NOT EXISTS idx_order_returns_order_id ON order_returns(order_id);

-- A reverse AWB is the courier's, not ours: Shiprocket hands back ids longer
-- than the 50 characters this column was created with.
ALTER TABLE order_returns ALTER COLUMN waybill TYPE TEXT;

-- Which courier the shipping partner actually assigned, shown to the customer
-- on the tracking page. The AWB alone does not say who is carrying it.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name TEXT;

-- When the order actually reached the customer. The return window is measured
-- from this, not from updated_at: updated_at moves every time anything touches
-- the row — a courier scan, a tracking poll — which silently restarted the
-- window on every read. Set once, by whichever writer first sees DELIVERED.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;

-- Backfill for orders delivered before this column existed. updated_at is the
-- best evidence available for them and is what the window already used.
UPDATE orders
SET delivered_at = updated_at
WHERE order_status = 'DELIVERED' AND delivered_at IS NULL;

-- Conditional shipping charge. Delivery used to be a hardcoded ₹0 that the
-- seller absorbed; it is now a slab table so the CMS can say things like
-- "₹99 under ₹1000, free above it" or "₹49 handling on COD" without a deploy.
--
-- min_order_amount is inclusive, max_order_amount is EXCLUSIVE, so the usual
-- pair of slabs is (min 0, max 1000) and (min 1000, max NULL) with no gap and
-- no overlap. The amount compared against is the payable cart value AFTER the
-- coupon and the automatic discount — the same number calculateAutoDiscount
-- works on — so a discount that drops the cart under the threshold does bring
-- the shipping charge back.
--
-- One rule ever applies: highest priority wins, ties break on the bigger slab.
-- When nothing matches, shipping is free — which is what an empty table means,
-- so installing this migration changes no price on its own.
CREATE TABLE IF NOT EXISTS shipping_charge_rules (
    id SERIAL PRIMARY KEY,

    title VARCHAR(255) NOT NULL,

    -- slab the cart value must fall into: min <= amount < max
    min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_order_amount NUMERIC(10,2),        -- NULL = no upper bound

    type VARCHAR(20) NOT NULL,             -- 'flat' | 'percentage' | 'free'
    value NUMERIC(10,2) NOT NULL DEFAULT 0,-- rupee amount, or percent of the cart
    max_charge_amount NUMERIC(10,2),       -- cap for percentage rules, NULL = uncapped

    -- 'ALL' matches both, otherwise the rule only fires for that payment method
    payment_method VARCHAR(10) NOT NULL DEFAULT 'ALL', -- 'ALL' | 'COD' | 'ONLINE'

    status VARCHAR(20) NOT NULL DEFAULT 'active',      -- 'active' | 'disabled'

    -- higher priority wins when several slabs match; ties break on the bigger slab
    priority INTEGER NOT NULL DEFAULT 0,

    starts_at TIMESTAMPTZ,                 -- NULL = no start boundary
    ends_at TIMESTAMPTZ,                   -- NULL = never expires

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_charge_rules_lookup
ON shipping_charge_rules(status, min_order_amount);

-- Which slab an order was charged under, so a later rule change never rewrites
-- history. The full snapshot also lives in orders.price_breakdown.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_rule_id INTEGER;

-- Idempotency for checkout. Placing an order is not naturally repeatable: a
-- double click, a browser refresh on a slow gateway call, an axios/proxy retry
-- after a timeout, or a back-button re-post all used to create a second orders
-- row (and for ONLINE, a second gateway order) for the same intent.
--
-- The client mints a UUID per checkout attempt and sends it as the
-- Idempotency-Key header. The first request to arrive INSERTs this row in its
-- own committed transaction BEFORE the order transaction opens, so a racing
-- duplicate sees it immediately. Whoever loses the INSERT either replays the
-- stored response (COMPLETED) or is told to retry (IN_PROGRESS).
--
-- request_hash guards against the client reusing one key for a different cart:
-- same key + different payload is a client bug, not a retry, and is rejected
-- rather than being answered with the wrong order's response.
--
-- Rows are kept forever: one row per checkout attempt is a useful audit trail
-- at this volume, and nothing here needs to expire for correctness.
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id SERIAL PRIMARY KEY,

    idempotency_key TEXT NOT NULL,
    user_id INT NOT NULL REFERENCES users(id),
    endpoint TEXT NOT NULL,          -- scopes the key, e.g. 'POST /orders/place-order'
    request_hash TEXT NOT NULL,      -- sha256 of the validated request payload

    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    -- IN_PROGRESS : reserved, the order transaction has not committed yet
    -- COMPLETED   : order committed, response_body below is the reply to replay
    -- FAILED      : the order transaction rolled back, nothing was created,
    --               so the same key may be retried from scratch

    order_id INT REFERENCES orders(order_id),
    response_status INT,
    response_message TEXT,
    response_body JSONB,             -- the `data` object of the original 201

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- The key is scoped per user so one customer's key can never collide with, or
-- replay, another's. This unique index is what makes the reservation atomic.
CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_keys_lookup
ON idempotency_keys(user_id, endpoint, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS unique_product_variant_sku
ON product_variants (sku);
-- ============================================================
-- REFUND AUDIT
--
-- A refund is decided by a person, so what they decided is worth keeping:
-- how much went back, why, and who pressed the button. refunded_amount also
-- makes a partial refund legible — status alone only ever says REFUNDED, and
-- without the amount nobody can tell 200 back from 2000.
--
-- It is also what tells apart a refund this api issued from one an admin did
-- by hand in the gateway's own portal and then recorded here.
-- ============================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_note TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_by INT REFERENCES users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP;
-- true when the money was moved by the gateway api, false when an admin
-- settled it outside this system and only recorded the fact.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_via_gateway BOOLEAN;

-- ============================================================
-- How the customer actually paid.
--
-- orders.payment_method only says ONLINE or COD. That is not enough for
-- support: a customer whose money left but whose order never confirmed quotes
-- their UPI id or the last four of their card, and a chargeback names the
-- issuing bank. So the gateway's own instrument payload is flattened into
-- these three columns by describeInstrument.
--
-- payment_instrument is the coarse kind, and the only one worth filtering or
-- reporting on. instrument_label is the line the CMS prints. instrument_detail
-- keeps the pieces it was built from, so a question the label does not answer
-- can still be answered without re-reading the whole gateway response.
--
-- Nothing here is ever a full card number: gateways only ever send the last
-- four, and nothing in this api asks for more.
-- ============================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_instrument VARCHAR(20);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS instrument_label TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS instrument_detail JSONB;

-- ============================================================
-- PRODUCT TAGS
--
-- products.tags is a jsonb set of tag names, so the tag text itself is what a
-- shopper filters on. This table is the catalogue of tags an admin may pick
-- from. Without it the CMS could only ever offer a hardcoded list, and a tag
-- invented while editing one product would be invisible to the next one.
-- ============================================================
CREATE TABLE IF NOT EXISTS product_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- tags are matched case insensitively, otherwise "New Arrival" and
-- "new arrival" both exist and split the same products into two filters
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_tags_name
ON product_tags (LOWER(name));

-- the set the CMS used to hardcode
INSERT INTO product_tags (name)
SELECT t.name FROM (VALUES
  ('Best Seller'),
  ('Recommendation'),
  ('New Arrival'),
  ('Featured'),
  ('Sale'),
  ('Trending')
) AS t(name)
ON CONFLICT DO NOTHING;

-- plus every tag already written onto a product before this table existed
INSERT INTO product_tags (name)
SELECT DISTINCT ON (LOWER(t.tag)) t.tag
FROM products p
CROSS JOIN LATERAL jsonb_object_keys(COALESCE(p.tags, '{}'::jsonb)) AS t(tag)
WHERE trim(t.tag) <> ''
ORDER BY LOWER(t.tag), t.tag
ON CONFLICT DO NOTHING;

-- ============================================================
-- BLOG AUTHORS
--
-- A post shows who wrote it, and the same few people write most of them, so
-- the author is a row of its own rather than a name retyped onto every post.
-- Editing a bio or a photo once then fixes it on every post that author wrote.
--
-- blogs.author_id stays what it was: the admin account that created the row,
-- kept for audit. blog_author_id is the byline the website prints, and the two
-- are not the same thing — an admin often publishes a post someone else wrote.
-- ============================================================
CREATE TABLE IF NOT EXISTS blog_authors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    designation TEXT,
    bio TEXT,
    image TEXT,
    email TEXT,
    website_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- one author per name, matched case insensitively, so "Ria Sen" and "ria sen"
-- can not become two bylines for the same person
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_authors_name
ON blog_authors (LOWER(name));

ALTER TABLE blogs ADD COLUMN IF NOT EXISTS blog_author_id INTEGER
  REFERENCES blog_authors(id) ON DELETE SET NULL;

-- ============================================================
-- SCHEDULING
--
-- published_at is when the post is meant to be public, which is not when the
-- row was created. A post is public only when status = 'published' AND
-- published_at <= NOW(), and that comparison happens on every read — so a
-- future date simply goes live by itself, with nothing running in the
-- background to flip it. Rows written before this column existed fall back to
-- created_at so nothing that was already live disappears.
-- ============================================================
-- TIMESTAMPTZ, unlike created_at next to it: a scheduled post has to go live
-- at an absolute instant, and only a tz-aware column compares correctly
-- against NOW() no matter what timezone the api process or the database runs
-- in. TO_CHAR(... AT TIME ZONE 'Asia/Kolkata') then prints it as IST.
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE blogs SET published_at = created_at
WHERE published_at IS NULL AND status = 'published';

CREATE INDEX IF NOT EXISTS idx_blogs_published_at ON blogs(published_at DESC);

-- ============================================================
-- OPEN GRAPH / TWITTER
--
-- Every one of these is optional. Left empty the api answers with the value
-- the page would otherwise use (meta_title, meta_description, cover image), so
-- a post gets correct share cards without anyone filling this section in, and
-- an admin only touches it when the share card should differ from the page.
-- ============================================================
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS og_title TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS og_description TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS og_image TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS og_type TEXT DEFAULT 'article';
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS canonical_url TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS twitter_card TEXT DEFAULT 'summary_large_image';
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS twitter_title TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS twitter_description TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS twitter_image TEXT;

-- ============================================================
-- BLOG MEDIA
--
-- Shaped exactly like product_images: one row per piece of media, ordered by
-- position, with type saying what the url in the image column is — an uploaded
-- image, or a video link (YouTube) that the website embeds instead of showing.
--
-- The first image-type row is the cover. blogs.cover_image is kept in sync
-- with it on every write so the listing and the share card keep reading one
-- column and nothing that already depends on it has to change.
-- ============================================================
CREATE TABLE IF NOT EXISTS blog_media (
    id SERIAL PRIMARY KEY,
    blog_id INTEGER REFERENCES blogs(id) ON DELETE CASCADE,
    image TEXT,
    alt_tag TEXT,
    type TEXT DEFAULT 'image',
    position INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_blog_media_blog_id ON blog_media(blog_id);

-- the cover every existing post already has becomes its first media row,
-- otherwise opening an old post in the CMS would show an empty gallery
INSERT INTO blog_media (blog_id, image, alt_tag, type, position)
SELECT b.id, b.cover_image, b.cover_image_alt, 'image', 0
FROM blogs b
WHERE b.cover_image IS NOT NULL
  AND trim(b.cover_image) <> ''
  AND NOT EXISTS (SELECT 1 FROM blog_media m WHERE m.blog_id = b.id);

-- ============================================================
-- PRODUCT SEARCH (full text)
--
-- The search box matches a product by its name or by any of its tag names, so
-- both live in one tsvector kept by the database itself — a generated column
-- never goes stale the way a trigger-maintained one does when a write path
-- forgets about it.
--
-- Weights carry where a word came from: 'A' is the product name, 'B' a tag.
-- That is what lets ?search_by=name / ?search_by=tag narrow the search to one
-- side without a second index or a second copy of the text.
--
-- The regconfig is spelled out ('english', not the default) because only the
-- explicit-config overloads of to_tsvector / jsonb_to_tsvector are IMMUTABLE,
-- and a generated column will not accept anything less. The CASE guards rows
-- whose tags are NULL or not an object: jsonb_to_tsvector only takes objects.
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
    setweight(
      jsonb_to_tsvector(
        'english',
        CASE WHEN jsonb_typeof(tags) = 'object' THEN tags ELSE '{}'::jsonb END,
        '["key"]'
      ),
      'B'
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_search_vector
ON products USING GIN (search_vector);

-- ============================================================
-- DASHBOARD ANALYTICS
--
-- The KPI endpoints read orders, order_items, payments and users over a date
-- window. None of those had an index on the column the window is cut on, so
-- every card was a sequential scan of the whole table.
-- ============================================================

-- Every KPI query starts by narrowing orders to the window, and the order list
-- screen already reads newest-first, so DESC serves both.
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Products Sold and Top Products join order_items back to the windowed orders.
-- order_id was only ever a foreign key, which postgres does not index for you.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Refunds are counted by when the money went back, not by when the order was
-- placed, so refunded_at is its own window column. Partial, because rows with
-- no refund are the overwhelming majority and none of them are ever read here.
CREATE INDEX IF NOT EXISTS idx_payments_refunded_at
  ON payments(refunded_at)
  WHERE refunded_amount > 0;

-- ------------------------------------------------------------
-- users.created_at
--
-- The Customers KPI counts people who signed up inside the window, and until
-- now there was nothing on a user row saying when that was.
--
-- Deliberately added WITHOUT a default first: a default would stamp every
-- existing row with the moment of the migration and the dashboard would report
-- the entire customer base as having signed up that day. Existing rows are
-- backfilled from their first order instead, which is a real date, and rows
-- with no order stay NULL — unknown, and counted in no window rather than in
-- the wrong one. The default is attached afterwards so new signups get a
-- timestamp without the signup code having to pass one.
-- ------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

UPDATE users u
SET created_at = first_orders.placed_at
FROM (
  SELECT user_id, MIN(created_at) AS placed_at
  FROM orders
  WHERE user_id IS NOT NULL
  GROUP BY user_id
) AS first_orders
WHERE u.id = first_orders.user_id
  AND u.created_at IS NULL;

ALTER TABLE users ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ------------------------------------------------------------
-- Generated order documents (invoice + packing slip)
--
-- The invoice an admin uploads by hand still lives in invoice_document as a
-- data URI. These columns are for the two PDFs the CMS generates instead: they
-- are rendered by the api, pushed to the upload server's PRIVATE area and only
-- the returned path is kept here, so an order row stays small no matter how
-- many times a document is regenerated.
--
-- invoice_number is allotted once, on the first generate, and deliberately
-- survives a regenerate — a customer who already has invoice INV-100023 must
-- not receive a second PDF calling itself something else. It comes from its own
-- sequence rather than from the order number because invoices are numbered in
-- the order they are issued, which is not the order in which orders are placed.
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 100001;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packing_slip_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packing_slip_generated_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_invoice_number
  ON orders(invoice_number)
  WHERE invoice_number IS NOT NULL;

-- ------------------------------------------------------------
-- Customer email log
--
-- Which of the customer-facing order emails have already gone out, one row per
-- (order, kind). The primary key is the whole guard: a send claims its row with
-- ON CONFLICT DO NOTHING and only mails when the insert actually took.
--
-- It is needed because nothing else in the status path is once-only. The
-- courier webhooks re-push their whole scan history, and syncShipmentTracking
-- runs from the customer's own tracking page — so "SHIPPED" is written to an
-- order over and over, and without this table every refresh would be another
-- email in the customer's inbox.
--
-- Rows are also the audit trail: what was sent to this order, and when.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_email_log (
  order_id   INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  email_type VARCHAR(40) NOT NULL,
  sent_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, email_type)
);

-- ------------------------------------------------------------
-- Guest checkout
--
-- A guest is still a users row. Every order, address, invoice, email and CMS
-- join in this codebase reaches the customer through orders.user_id, so the
-- alternative — a nullable user_id plus a parallel set of guest_* columns —
-- would have meant a COALESCE in every one of those queries and a second
-- code path in each of them forever.
--
-- What makes the row a guest is that nobody has ever proved they own it:
-- password is NULL and is_verified stays false, so it cannot be logged into.
-- It becomes a real account the moment the customer sets a password through
-- the ordinary send-otp / verify-otp flow, which clears this flag — the orders
-- already attached to the row then simply appear in their history.
-- ------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT false;

-- The CMS lists customers and guests separately, and the guest side of that
-- split is the smaller one, so the index only covers it.
CREATE INDEX IF NOT EXISTS idx_users_is_guest ON users(is_guest) WHERE is_guest = true;

-- Whether this order was placed without logging in. The users row alone cannot
-- answer that: a guest who later sets a password stops being a guest, and their
-- earlier orders would retroactively look like account orders. The CMS shows
-- this flag, so it has to mean "how it was placed", not "what the customer is
-- now".
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_guest_order BOOLEAN DEFAULT false;

-- ============================================================
-- COMBO PRODUCTS (product_bundle_items)
--
-- A combo is an ordinary product row that also carries a list of other
-- products which physically go in the same box. The client builds one by
-- creating the combo as a normal product and picking the existing products it
-- contains, so nothing about pricing, images, SEO or discounts changes: the
-- combo is priced and sold as one line, and this table only records what is
-- inside it.
--
-- Two things read it. Stock: selling one combo also consumes each child, so a
-- product's available_quantity stays true whether it sold on its own or inside
-- a combo. Documents: the invoice, packing slip and payment slip print the
-- contents underneath the combo line, because the person packing the parcel has
-- to know what to put in it.
--
-- A child is deliberately allowed to be a specific variant rather than the
-- whole product — "Lip Balm / Red 20g" is what goes in the box, and the packer
-- and the stock count both need that precision. child_variant_id NULL means the
-- product itself, the same distinction order_items already draws between
-- product_info and variant_info.
-- ============================================================
CREATE TABLE IF NOT EXISTS product_bundle_items (
    id SERIAL PRIMARY KEY,

    -- the combo this row belongs to. Dropping the combo drops its contents;
    -- the child products themselves are untouched.
    parent_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- what goes in the box. RESTRICT, not CASCADE: silently emptying a combo
    -- because someone deleted one of its products would ship a half parcel.
    -- deleteProduct turns the resulting 23503 into a readable message.
    child_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    child_variant_id INTEGER REFERENCES product_variants(id) ON DELETE RESTRICT,

    -- how many of the child one combo contains
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),

    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),

    -- a combo cannot contain itself
    CONSTRAINT product_bundle_items_not_self CHECK (parent_product_id <> child_product_id)
);

-- The same child twice in one combo is a quantity, not two rows. COALESCE
-- because NULL never equals NULL, so a plain UNIQUE would let the whole-product
-- row be added over and over.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_bundle_items_unique
ON product_bundle_items (parent_product_id, child_product_id, COALESCE(child_variant_id, 0));

CREATE INDEX IF NOT EXISTS idx_product_bundle_items_parent
ON product_bundle_items (parent_product_id);

-- deleteProduct asks "is this product inside any combo?" before it deletes
CREATE INDEX IF NOT EXISTS idx_product_bundle_items_child
ON product_bundle_items (child_product_id);

-- ============================================================
-- CART — the logged-in customer's cart, kept server side
--
-- The storefront still keeps a localStorage cart so a guest can shop without
-- an account; on login those rows are merged in here and this table becomes
-- the source of truth, which is what makes a cart survive a new device and
-- what the CMS reads to see what a customer left behind.
--
-- One row per (user, product, variant). variant_id is NULL for a product sold
-- without options, and NULL never equals NULL, so the uniqueness has to go
-- through COALESCE the same way product_bundle_items does it.
-- ============================================================
CREATE TABLE IF NOT EXISTS cart (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- the exact variant the customer picked, NULL when the product has none
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,

    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_unique_item
ON cart (user_id, product_id, COALESCE(variant_id, 0));

CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_product_id ON cart(product_id);
