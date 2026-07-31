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

INSERT INTO store_settings (key, value) VALUES
  ('gst_percentage',  '3'),
  ('shipping_charge', '0')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_breakdown JSONB;

-- Bigship integration
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bigship_order_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_bigship_order_id ON orders(bigship_order_id);

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
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags_jsonb JSONB DEFAULT '{}';

UPDATE products
SET tags_jsonb = (
  SELECT jsonb_object_agg(trim(t), true)
  FROM unnest(string_to_array(trim(tags), ',')) AS t
)
WHERE tags IS NOT NULL AND trim(tags) != '';

ALTER TABLE products DROP COLUMN IF EXISTS tags;
ALTER TABLE products RENAME COLUMN tags_jsonb TO tags;

CREATE INDEX IF NOT EXISTS idx_products_tags_gin ON products USING GIN (tags);
-- Category visibility (public / private). Private categories are only visible to admins
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_categories_is_visible ON categories(is_visible);
