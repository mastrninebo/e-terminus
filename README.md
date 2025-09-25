# E‑Terminus

Modern bus ticketing and scheduling platform for operators and passengers. It provides route discovery, bookings, payments, reviews, and role-based admin/operator dashboards.


## Features

- Public landing and search pages (static HTML/CSS/JS)
- Passenger registration, email verification, login with JWT-based sessions
- Operator and Admin roles with dedicated dashboards
- Route discovery and popular routes API
- Schedules, bookings, tickets with QR codes
- Payments via Zynle Pay (mobile money, card); callback handling
- Reviews (submit and moderation)
- Basic security features: CSRF on register, CORS, rate limiting and account lockout on login, HTTP-only cookies, prepared statements


## Tech Stack

- PHP 8+ (procedural + lightweight helpers)
- MySQL 5.7/8.0
- Composer packages:
  - phpmailer/phpmailer – SMTP email
  - vlucas/phpdotenv – environment variables (available; loading may be app-specific)
  - guzzlehttp/guzzle – HTTP client (optional for integrations)
  - firebase/php-jwt – included dependency; project currently uses a custom JWT helper
- Frontend: Vanilla HTML/CSS/JS
- Web server: Apache (XAMPP on Windows)


## Directory Structure

- /public – public-facing pages and assets
  - /assets/css, /assets/js, /images
  - index.html, login.html, register.html, search-results.html, booking-confirmation.html
- /admin – admin-facing static pages + assets
- /operators – operator-facing static pages + assets
- /api – PHP API endpoints grouped by domain
  - /auth – login, logout, register, check_session, user-info
  - /bookings – create_booking, get_booking
  - /payments – zynle_callback, update_status
  - /passenger – profile, settings, trips, reviews
  - /operator – fleet, schedules, stats
  - /admin – user/operator/bookings management, stats, reviews
  - get_popular_routes.php, search_routes.php, schedules/get_schedule.php, reviews/submit.php
- /includes – application helpers
  - auth-check.php – centralized auth and permission checks
  - jwt-helper.php – custom JWT generator/validator
  - EmailService.php – SMTP email sending (requires config/email.php)
  - ZynlePayService.php – Zynle Pay integration client
- /config – configuration files
  - database.php – PDO connection (singleton)
  - zynlepay.php – payment provider configuration
  - jwt-secret.key – default JWT secret key file
- /database – schema and demo data
  - schema.sql, demo_data.sql
- composer.json, composer.lock, vendor/


## Setup

### Prerequisites

- PHP 8.1+ with extensions: PDO, pdo_mysql, curl, openssl, mbstring
- MySQL 5.7+ / MariaDB 10+
- Composer
- Apache (XAMPP recommended on Windows)

### Installation

1) Place the repository in your web root (e.g., C:\xampp\htdocs\e-terminus).
2) Install PHP dependencies:

```bash
cd c:\xampp\htdocs\e-terminus
composer install
```

3) Configure your environment (see below).
4) Import the database schema and optionally demo data.
5) Start Apache and MySQL, then open http://localhost/e-terminus/public/index.html


## Configuration

Important: Do not commit secrets. Prefer environment variables or local-only config files (tracked in .gitignore).

### Database

- Edit config/database.php to match your local credentials (host, db, user, password).
- Ensure the database exists and credentials allow CREATE/ALTER/SELECT/INSERT/UPDATE/DELETE.

### JWT Secret

- jwt-helper reads JWT_SECRET from the environment, else falls back to config/jwt-secret.key
- Option A (recommended): Set system/server env var JWT_SECRET
- Option B: Put a strong random string in config/jwt-secret.key (file already present)

Example (Windows setx for dev; restart Apache after):

```powershell
setx JWT_SECRET "your-256-bit-random-secret"
```

### Email (SMTP)

- EmailService expects config/email.php returning an array of SMTP settings.
- Create config/email.php (not committed) with content like:

```php
<?php
return [
  'host' => 'smtp.example.com',
  'port' => 587,
  'smtp_secure' => PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS,
  'username' => 'no-reply@example.com',
  'password' => 'app-password-or-secret',
];
```

- Verification link currently points to http://localhost/e-terminus/verify-email.php. Adjust if deploying under a different domain/path.

### Payments (Zynle Pay)

- Edit config/zynlepay.php with your sandbox/production credentials and callback base URL.
- For local development, expose Apache with a public URL (e.g., ngrok) and update the domain in zynlepay.php so callbacks reach your machine.
- Callback endpoint: /api/payments/zynle_callback.php

Security note: Do not commit real merchant IDs or API keys. Use environment variables or a non-tracked config file.


## Database Setup

1) Create the database and tables:

```sql
SOURCE database/Schema3.sql;
```

2) (Optional) Seed demo data for quick testing:

```sql
SOURCE database/demo_data.sql;
```

### Important: Schema Alignment Notes

This project ships with the currently used schema at database/Schema3.sql. It already includes most fields referenced by the codebase. Key highlights:

- users table (present):
  - is_verified, verification_token, reset_token, reset_token_expires, last_login, login_attempts, account_locked, is_phone_verified, phone_verification_code
- operators table (present):
  - operator_code VARCHAR(20) UNIQUE NOT NULL, verification_status ENUM('pending','verified','rejected')
- schedules table (present):
  - available_seats INT (remaining capacity)
- bookings table (present):
  - number_of_seats INT DEFAULT 1, booking_status ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending', payment_status ENUM('pending','success','failed'), transaction_ref VARCHAR(100)
- payments table (present):
  - payment_method ENUM('mobile_money','card','cash','zynlepay'), status ENUM('pending','success','failed'), transaction_id VARCHAR(100)
- user_sessions table (present):
  - session_id VARCHAR(128) PRIMARY KEY, user_id, jwt_token TEXT, ip_address VARCHAR(45), user_agent TEXT, created_at TIMESTAMP, expires_at DATETIME, index on jwt_token
- reviews table (present):
  - operator_id, review_type ENUM('platform','operator'), is_approved flag, rating CHECK 1..5

Required adjustment to match code paths precisely:
- includes/auth-check.php filters sessions with "revoked = 0". Add a revoked column to user_sessions:

```sql
ALTER TABLE user_sessions
  ADD COLUMN revoked TINYINT(1) NOT NULL DEFAULT 0 AFTER user_agent;
```

Notes:
- Earlier iterations referenced seat_number in bookings; Schema3 uses number_of_seats instead, which aligns with current booking flow.
- If you imported an older schema, re-import Schema3.sql or apply targeted ALTER statements to align with the above.

Adjust your schema accordingly before using the APIs that depend on these.


## Running the App

- Local: http://localhost/e-terminus/public/index.html
- Admin pages: /admin
- Operator pages: /operators
- API base: http://localhost/e-terminus/api

If you prefer a cleaner URL (without /e-terminus), configure an Apache VirtualHost to serve this directory as a site root.


## Authentication & Sessions

- JWTs are generated by includes/jwt-helper.php and returned by /api/auth/login.php
- Tokens are also set as HTTP-only cookies (auth_token) and stored in the user_sessions table with expiry
- Protect endpoints using includes/auth-check.php (provides requireAuth, requireAdmin, requireOperator)
- Pass token via Authorization: Bearer <token>, or rely on cookie when requests originate from the same site

Security:
- Rate limiting and account lockout present in login (5 failed attempts => lock)
- CSRF token is required on register endpoint
- CORS is restricted to specific local origins; adjust as needed for your frontend


## API Overview

Base URL: http://localhost/e-terminus/api

Selected endpoints:

- Auth
  - POST /auth/register.php
  - POST /auth/login.php
  - POST /auth/logout.php
  - GET  /auth/check_session.php
  - GET  /auth/user-info.php

- Public
  - GET  /get_popular_routes.php
  - GET  /search_routes.php?origin=Lusaka&destination=Ndola&date=YYYY-MM-DD

- Bookings
  - POST /bookings/create_booking.php (Authorization: Bearer required)
  - GET  /bookings/get_booking.php?id=123 (Authorization: Bearer)

- Payments
  - POST /payments/zynle_callback.php (Provider callback)
  - POST /payments/update_status.php (internal/status adjustments)

- Passenger
  - /passenger/get_stats.php, get_upcoming_trips.php, get_completed_trips.php, get_recent_activity.php, get_reviews.php, get_pending_reviews.php
  - /passenger/update_profile.php, change_password.php, update_notifications.php, cancel_booking.php

- Operator
  - /operator/get_stats.php, get_bookings.php, get_buses.php, create_bus.php, update_bus.php, delete_bus.php
  - /operator/get_schedules.php, create_schedule.php, update_schedule.php, delete_schedule.php
  - /operator/update_profile.php, change_password.php

- Admin
  - /admin/get_stats.php, get_recent_bookings.php, get_all_bookings.php, get_reviews.php
  - /admin/get_users.php, update_user.php, delete_user.php
  - /admin/get_operators.php, create_operator.php, update_operator.php, delete_operator.php, verify_operator.php, approve_review.php, cancel_booking.php


### Example: Register

Request:

```http
POST /api/auth/register.php
Content-Type: application/json

{
  "username": "jane_doe",
  "email": "jane@example.com",
  "phone": "260977000000",
  "password": "StrongPass1",
  "csrfToken": "<get from initial OPTIONS/GET response>"
}
```

Response 201:

```json
{
  "success": true,
  "message": "Registration successful! Please check your email to verify your account.",
  "user_id": 42,
  "email_sent": true,
  "csrf_token": "<new token>"
}
```

### Example: Login

Request:

```http
POST /api/auth/login.php
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "StrongPass1",
  "remember": true
}
```

Response 200:

```json
{
  "success": true,
  "token": "<jwt>",
  "user": { "id": 42, "username": "jane_doe", "email": "jane@example.com", "user_type": "passenger", "is_admin": false },
  "redirect": "/public/dashboard.html"
}
```

Use the token in Authorization header for subsequent API calls.

### Example: Create Booking

Headers:

```
Authorization: Bearer <jwt>
Content-Type: application/json
```

Body:

```json
{
  "schedule_id": 1,
  "number_of_seats": 2,
  "payment_method": "mobile_money",
  "payment_details": { "mobile_number": "977123456" }
}
```

Response 200 (Zynle initiation):

```json
{
  "success": true,
  "booking_id": 1001,
  "payment_id": 555,
  "payment_initiated": true,
  "transaction_id": "...",
  "reference_no": "ET-...",
  "message": "Payment initiated successfully. Please complete the payment on your mobile device.",
  "redirect_url": "payment-simulation.html?booking_id=1001&transaction_id=...&amount=..."
}
```


## Payments Flow (Zynle Pay)

- Client calls POST /bookings/create_booking.php with payment_method mobile_money or card
- Server creates booking + pending payment, then calls Zynle Pay with customer phone and amount
- On success, response includes reference/transaction details for tracking
- Zynle posts callback to /payments/zynle_callback.php which updates payment and booking statuses
- For local testing without real callbacks, use payment-simulation.html

Ensure callback URLs in config/zynlepay.php match your publicly accessible domain.


## Frontend Pages

- Public: /public/index.html, search-results.html, booking-confirmation.html
- Auth: /public/login.html, /public/register.html
- Operator: /operators/dashboard.html, /operators/schedules.html
- Admin: /admin/dashboard.html, /admin/bookings.html, /admin/trips.html

Pages use vanilla JS modules in /assets and /public/assets for fetching APIs and UI updates.


## Security & Best Practices

- Never commit real secrets. Move credentials to environment variables or non-tracked configs
- Keep JWT secret long and random; rotate periodically
- Serve over HTTPS in production; set secure cookies and appropriate SameSite settings
- Validate and sanitize all inputs; continue using prepared statements
- Restrict CORS origins appropriately
- Use rate limiting and lockouts for auth endpoints (already present)
- Log errors server-side; avoid leaking internal details to clients


## Testing

- Manual testing with browser/UI and tools like Postman
- Suggested next steps: add PHPUnit and create tests under /tests for:
  - Auth flows (register, login, session)
  - Bookings and payments (using mocks for payment provider)
  - Role-based access in admin/operator APIs
- Consider adding a Postman collection for common API flows


## Troubleshooting

- Database connection failed: verify config/database.php and that MySQL is running. Ensure PDO MySQL extension enabled
- Missing JWT secret: set JWT_SECRET or populate config/jwt-secret.key
- Email not sending: create config/email.php and verify SMTP. Use EmailService->testConnection in a small script
- CORS errors: update allowed origins in auth endpoints before deploying frontend elsewhere
- Zynle Pay callbacks not received: ensure ngrok/public URL is correct and configured in config/zynlepay.php; check api/payments/zynle_callback_log.txt
- Schema mismatches: apply the Schema Alignment Notes above; compare your DB columns with how endpoints query them


## License

Proprietary – All rights reserved unless a license file is added to this repository.


## Acknowledgements

- PHPMailer
- Zynle Pay API
- XAMPP community
