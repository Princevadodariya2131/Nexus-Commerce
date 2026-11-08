-- ============================================================
-- NEXUS COMMERCE - MySQL Database (XAMPP / phpMyAdmin)
-- ============================================================
-- 1. Open phpMyAdmin: http://localhost/phpmyadmin
-- 2. Click "Import" or run this SQL in the SQL tab
-- ============================================================

CREATE DATABASE IF NOT EXISTS `nexus_commerce`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `nexus_commerce`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `wishlist_items`;
DROP TABLE IF EXISTS `cart_items`;
DROP TABLE IF EXISTS `order_status_history`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `coupon_products`;
DROP TABLE IF EXISTS `coupon_categories`;
DROP TABLE IF EXISTS `coupons`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `vendors`;
DROP TABLE IF EXISTS `user_addresses`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `carts`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `banners`;
DROP TABLE IF EXISTS `blogs`;
DROP TABLE IF EXISTS `analytics`;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `avatar` VARCHAR(500) NULL,
  `phone` VARCHAR(30) NULL,
  `role` ENUM('customer','vendor','admin','super_admin') NOT NULL DEFAULT 'customer',
  `is_email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `email_verification_token` VARCHAR(255) NULL,
  `email_verification_expires` DATETIME NULL,
  `password_reset_token` VARCHAR(255) NULL,
  `password_reset_expires` DATETIME NULL,
  `refresh_token` TEXT NULL,
  `language` VARCHAR(10) NOT NULL DEFAULT 'en',
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `notify_email` TINYINT(1) NOT NULL DEFAULT 1,
  `notify_push` TINYINT(1) NOT NULL DEFAULT 1,
  `notify_marketing` TINYINT(1) NOT NULL DEFAULT 0,
  `vendor_id` INT UNSIGNED NULL,
  `last_login` DATETIME NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_addresses` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `label` VARCHAR(50) NOT NULL DEFAULT 'Home',
  `street` VARCHAR(255) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `state` VARCHAR(100) NOT NULL,
  `country` VARCHAR(100) NOT NULL,
  `zip_code` VARCHAR(20) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_addresses_user` (`user_id`),
  CONSTRAINT `fk_addresses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- VENDORS
-- ------------------------------------------------------------
CREATE TABLE `vendors` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `business_name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `logo` VARCHAR(500) NULL,
  `banner` VARCHAR(500) NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(30) NULL,
  `street` VARCHAR(255) NULL,
  `city` VARCHAR(100) NULL,
  `state` VARCHAR(100) NULL,
  `country` VARCHAR(100) NULL,
  `zip_code` VARCHAR(20) NULL,
  `tax_id` VARCHAR(100) NULL,
  `bank_account_name` VARCHAR(255) NULL,
  `bank_account_number` VARCHAR(100) NULL,
  `bank_name` VARCHAR(255) NULL,
  `bank_routing_number` VARCHAR(50) NULL,
  `status` ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  `total_sales` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_earnings` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `pending_payout` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `rating` DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  `review_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vendors_user` (`user_id`),
  UNIQUE KEY `uk_vendors_slug` (`slug`),
  KEY `idx_vendors_status` (`status`),
  CONSTRAINT `fk_vendors_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- CATEGORIES & PRODUCTS
-- ------------------------------------------------------------
CREATE TABLE `categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `image` VARCHAR(500) NULL,
  `parent_id` INT UNSIGNED NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categories_slug` (`slug`),
  KEY `fk_categories_parent` (`parent_id`),
  CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `products` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `short_description` VARCHAR(500) NULL,
  `sku` VARCHAR(100) NOT NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `compare_at_price` DECIMAL(12,2) NULL,
  `cost_price` DECIMAL(12,2) NULL,
  `images` JSON NULL,
  `category_id` INT UNSIGNED NOT NULL,
  `subcategory_id` INT UNSIGNED NULL,
  `vendor_id` INT UNSIGNED NULL,
  `brand` VARCHAR(100) NULL,
  `tags` JSON NULL,
  `variants` JSON NULL,
  `stock` INT UNSIGNED NOT NULL DEFAULT 0,
  `low_stock_threshold` INT UNSIGNED NOT NULL DEFAULT 10,
  `weight` DECIMAL(10,2) NULL,
  `rating` DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  `review_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `sold_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `seo_title` VARCHAR(255) NULL,
  `seo_description` TEXT NULL,
  `seo_keywords` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_products_slug` (`slug`),
  UNIQUE KEY `uk_products_sku` (`sku`),
  KEY `idx_products_category` (`category_id`),
  KEY `idx_products_vendor` (`vendor_id`),
  KEY `idx_products_featured` (`is_featured`, `is_active`),
  FULLTEXT KEY `ft_products_search` (`name`, `description`),
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  CONSTRAINT `fk_products_subcategory` FOREIGN KEY (`subcategory_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_products_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- CART & WISHLIST
-- ------------------------------------------------------------
CREATE TABLE `carts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `coupon_id` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_carts_user` (`user_id`),
  CONSTRAINT `fk_carts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cart_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cart_id` INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `variant` VARCHAR(100) NULL,
  `price` DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cart_product_variant` (`cart_id`, `product_id`, `variant`),
  CONSTRAINT `fk_cart_items_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cart_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `wishlist_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wishlist_user_product` (`user_id`, `product_id`),
  CONSTRAINT `fk_wishlist_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wishlist_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- COUPONS
-- ------------------------------------------------------------
CREATE TABLE `coupons` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `description` VARCHAR(500) NULL,
  `type` ENUM('percentage','fixed') NOT NULL,
  `value` DECIMAL(12,2) NOT NULL,
  `min_order_amount` DECIMAL(12,2) NULL,
  `max_discount` DECIMAL(12,2) NULL,
  `usage_limit` INT UNSIGNED NULL,
  `used_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `per_user_limit` INT UNSIGNED NOT NULL DEFAULT 1,
  `valid_from` DATETIME NOT NULL,
  `valid_until` DATETIME NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_coupons_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `carts`
  ADD CONSTRAINT `fk_carts_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- ORDERS
-- ------------------------------------------------------------
CREATE TABLE `orders` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_number` VARCHAR(50) NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `subtotal` DECIMAL(12,2) NOT NULL,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `shipping` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL,
  `coupon_id` INT UNSIGNED NULL,
  `ship_street` VARCHAR(255) NOT NULL,
  `ship_city` VARCHAR(100) NOT NULL,
  `ship_state` VARCHAR(100) NOT NULL,
  `ship_country` VARCHAR(100) NOT NULL,
  `ship_zip_code` VARCHAR(20) NOT NULL,
  `ship_phone` VARCHAR(30) NULL,
  `status` ENUM('pending','confirmed','processing','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
  `payment_status` ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  `payment_method` ENUM('stripe','razorpay','cod') NULL,
  `payment_intent_id` VARCHAR(255) NULL,
  `razorpay_order_id` VARCHAR(255) NULL,
  `tracking_number` VARCHAR(100) NULL,
  `tracking_url` VARCHAR(500) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_orders_number` (`order_number`),
  KEY `idx_orders_user` (`user_id`),
  KEY `idx_orders_status` (`status`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_orders_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `vendor_id` INT UNSIGNED NULL,
  `name` VARCHAR(255) NOT NULL,
  `sku` VARCHAR(100) NOT NULL,
  `image` VARCHAR(500) NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `variant` VARCHAR(100) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_vendor` (`vendor_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_order_items_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_status_history` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` INT UNSIGNED NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `note` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_status_history_order` (`order_id`),
  CONSTRAINT `fk_status_history_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- REVIEWS
-- ------------------------------------------------------------
CREATE TABLE `reviews` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `order_id` INT UNSIGNED NULL,
  `rating` TINYINT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NULL,
  `comment` TEXT NOT NULL,
  `images` JSON NULL,
  `is_verified_purchase` TINYINT(1) NOT NULL DEFAULT 0,
  `is_approved` TINYINT(1) NOT NULL DEFAULT 0,
  `helpful_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reviews_user_product` (`user_id`, `product_id`),
  KEY `idx_reviews_product` (`product_id`, `is_approved`),
  CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_reviews_rating` CHECK (`rating` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- CMS & SYSTEM
-- ------------------------------------------------------------
CREATE TABLE `notifications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `data` JSON NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `link` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`, `is_read`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NULL,
  `action` VARCHAR(100) NOT NULL,
  `resource` VARCHAR(100) NOT NULL,
  `resource_id` VARCHAR(50) NULL,
  `details` JSON NULL,
  `ip` VARCHAR(45) NULL,
  `user_agent` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_resource` (`resource`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `banners` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `subtitle` VARCHAR(500) NULL,
  `image` VARCHAR(500) NOT NULL,
  `mobile_image` VARCHAR(500) NULL,
  `link` VARCHAR(500) NULL,
  `position` ENUM('hero','promo','sidebar','footer') NOT NULL DEFAULT 'hero',
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `start_date` DATETIME NULL,
  `end_date` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `blogs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `excerpt` TEXT NULL,
  `content` LONGTEXT NOT NULL,
  `cover_image` VARCHAR(500) NULL,
  `author_id` INT UNSIGNED NOT NULL,
  `tags` JSON NULL,
  `is_published` TINYINT(1) NOT NULL DEFAULT 0,
  `published_at` DATETIME NULL,
  `seo_title` VARCHAR(255) NULL,
  `seo_description` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_blogs_slug` (`slug`),
  CONSTRAINT `fk_blogs_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `analytics` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `date` DATE NOT NULL,
  `revenue` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `orders` INT UNSIGNED NOT NULL DEFAULT 0,
  `new_users` INT UNSIGNED NOT NULL DEFAULT 0,
  `page_views` INT UNSIGNED NOT NULL DEFAULT 0,
  `conversion_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `average_order_value` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `top_products` JSON NULL,
  `top_categories` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_analytics_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DATA (categories, products — run npm run seed for users)
-- ============================================================

INSERT INTO `categories` (`name`, `slug`, `sort_order`) VALUES
('Electronics', 'electronics', 1),
('Fashion', 'fashion', 2),
('Home & Living', 'home-living', 3),
('Accessories', 'accessories', 4);

INSERT INTO `products` (`name`, `slug`, `description`, `sku`, `price`, `compare_at_price`, `category_id`, `brand`, `tags`, `stock`, `is_featured`, `images`, `rating`, `review_count`, `sold_count`) VALUES
('Nexus Pro Wireless Headphones', 'nexus-pro-wireless-headphones', 'Premium noise-cancelling wireless headphones with 40-hour battery life.', 'NX-HP-001', 349.99, 449.99, 1, 'Nexus', '["audio","wireless","premium"]', 150, 1, '[{"url":"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800","isPrimary":true}]', 4.80, 234, 1200),
('Aurora Smart Watch Ultra', 'aurora-smart-watch-ultra', 'Titanium case smartwatch with health tracking.', 'NX-SW-002', 799.99, 999.99, 1, 'Aurora', '["wearable","smart"]', 80, 1, '[{"url":"https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800","isPrimary":true}]', 4.90, 512, 890),
('Minimalist Leather Jacket', 'minimalist-leather-jacket', 'Handcrafted Italian leather jacket.', 'NX-FA-003', 589.99, NULL, 2, 'Nexus Atelier', '["fashion","leather"]', 45, 1, '[{"url":"https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800","isPrimary":true}]', 4.70, 89, 340),
('Ceramic Artisan Vase Set', 'ceramic-artisan-vase-set', 'Set of three hand-thrown ceramic vases.', 'NX-HL-004', 129.99, NULL, 3, 'Artisan Co', '["home","decor"]', 200, 0, '[{"url":"https://images.unsplash.com/photo-1578500494190-abc6c9335b71?w=800","isPrimary":true}]', 4.60, 67, 520);

INSERT INTO `coupons` (`code`, `description`, `type`, `value`, `max_discount`, `usage_limit`, `valid_from`, `valid_until`) VALUES
('WELCOME20', '20% off your first order', 'percentage', 20.00, 100.00, 1000, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR));

INSERT INTO `banners` (`title`, `subtitle`, `image`, `position`, `sort_order`) VALUES
('The Future of Commerce', 'Discover premium products curated by AI', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920', 'hero', 1);
