# Nexus Commerce API Reference

Base URL: `http://localhost:4000/api/v1`

## Authentication

All protected routes accept:
- `Authorization: Bearer <token>` header
- `accessToken` HTTP-only cookie

### POST /auth/register
```json
{ "email": "user@example.com", "password": "password123", "firstName": "John", "lastName": "Doe" }
```

### POST /auth/login
```json
{ "email": "user@example.com", "password": "password123" }
```

### POST /auth/refresh
Refreshes access token using refresh cookie.

### GET /auth/me
Returns authenticated user profile.

---

## Products

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /products | - | List products (paginated) |
| GET | /products/featured | - | Featured products |
| GET | /products/categories | - | All categories |
| GET | /products/recommendations | Optional | AI recommendations |
| GET | /products/:slug | - | Product detail |
| POST | /products | Vendor/Admin | Create product |
| PATCH | /products/:id | Vendor/Admin | Update product |
| DELETE | /products/:id | Vendor/Admin | Soft delete |

**Query params:** `page`, `limit`, `category`, `search`, `sort`, `minPrice`, `maxPrice`

---

## Cart

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /cart | ✓ | Get cart |
| POST | /cart/items | ✓ | Add item |
| PATCH | /cart/items/:productId | ✓ | Update quantity |
| DELETE | /cart/items/:productId | ✓ | Remove item |

---

## Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /orders | ✓ | Create order from cart |
| GET | /orders/my | ✓ | User orders |
| GET | /orders/:id | ✓ | Order detail |
| GET | /orders/track/:orderNumber | - | Public tracking |
| GET | /orders/admin/all | Admin | All orders |
| PATCH | /orders/:id/status | Admin/Vendor | Update status |

---

## Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/dashboard | Dashboard stats |
| GET | /admin/analytics/revenue | Revenue chart |
| GET | /admin/users | User management |
| GET | /admin/vendors | Vendor management |
| GET | /admin/reviews | Review moderation |
| GET | /admin/coupons | Coupon list |
| POST | /admin/coupons | Create coupon |
| GET | /admin/banners | Banner list |
| POST | /admin/banners | Create banner |

---

## Vendor

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /vendor/onboard | Vendor registration |
| GET | /vendor/dashboard | Vendor stats |
| GET | /vendor/products | Vendor products |
| GET | /vendor/orders | Vendor orders |

---

## AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /ai/chat | AI assistant chat |
| GET | /ai/search-suggestions | Smart search |
| GET | /ai/recommendations | Personalized picks |

---

## Response Format

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```
