# MySQL Setup with XAMPP

## Step 1 — Start XAMPP

1. Open **XAMPP Control Panel**
2. Start **Apache** (optional, for phpMyAdmin)
3. Start **MySQL**

## Step 2 — Create database

### Option A: phpMyAdmin (recommended)

1. Open http://localhost/phpmyadmin
2. Click **Import**
3. Choose file: `database/nexus_commerce.sql`
4. Click **Go**

### Option B: SQL tab

1. Open phpMyAdmin → **SQL** tab
2. Paste contents of `database/nexus_commerce.sql`
3. Click **Go**

## Step 3 — Configure `.env`

```env
DATABASE_URL="mysql://root@localhost:3306/nexus_commerce"
```

If you set a MySQL root password in XAMPP:

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/nexus_commerce"
```

## Step 4 — Install & seed

```bash
npm install
cd apps/api
npx prisma generate
cd ../..
npm run seed --workspace=@nexus/api
npm run dev
```

## Demo accounts (after seed)

| Role     | Email                    | Password       |
|----------|--------------------------|----------------|
| Admin    | admin@nexuscommerce.io   | Admin@123456   |
| Customer | customer@demo.com        | Customer@123   |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` | Start MySQL in XAMPP |
| `Access denied` | Check password in `DATABASE_URL` |
| `Unknown database` | Import `nexus_commerce.sql` again |
| Port 3306 in use | Change port in XAMPP MySQL config |
