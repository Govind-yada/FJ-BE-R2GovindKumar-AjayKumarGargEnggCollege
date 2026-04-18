# Finflow — Personal Finance Tracker

> **Round 2 Take-Home Assignment** · Node.js + Express.js + PostgreSQL + HTML/CSS/JS

---

## Quick Start (5 commands)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET etc.

# 3. Create database
createdb finflow_db

# 4. Run migrations
npm run migrate

# 5. Start dev server
npm run dev
# → http://localhost:5000
```

---

## Project Structure

```
finflow/
├── public/                        # Frontend (HTML/CSS/JS) — served statically
│   ├── index.html                 # Single-page application entry point
│   ├── css/
│   │   └── styles.css             # Design tokens, components, pages, animations
│   └── js/
│       ├── api.js                 # API client — all fetch() calls, token refresh
│       ├── utils.js               # Toast, Modal, Charts, Nav, fmtCur, helpers
│       ├── pages.js               # DashboardPage, TxPage, BudgetPage, ReportsPage, ProfilePage
│       └── app.js                 # Bootstrap, Auth flow, event binding, AppState
│
├── src/                           # Backend (Node.js + Express.js)
│   ├── server.js                  # Express app, middleware chain, route mounting
│   │
│   ├── config/
│   │   └── database.js            # pg Pool, query(), withTransaction()
│   │
│   ├── middleware/
│   │   ├── auth.js                # authenticateJWT middleware
│   │   ├── validate.js            # Joi schema validation wrapper
│   │   ├── upload.js              # Multer — receipt uploads (JPEG/PNG/PDF ≤5 MB)
│   │   └── errorHandler.js        # Centralised error → JSON, AppError class, 404
│   │
│   ├── routes/
│   │   ├── auth.routes.js         # POST /register /login /refresh /logout, GET /me
│   │   ├── transaction.routes.js  # CRUD /api/transactions (with file upload)
│   │   ├── budget.routes.js       # CRUD /api/budgets
│   │   ├── category.routes.js     # CRUD /api/categories (soft-delete)
│   │   └── report.routes.js       # GET /reports/dashboard|monthly|category|net-worth
│   │
│   ├── controllers/               # Thin — parse req, call service, send res
│   │   ├── auth.controller.js
│   │   ├── transaction.controller.js
│   │   ├── budget.controller.js
│   │   ├── category.controller.js
│   │   └── report.controller.js
│   │
│   ├── services/                  # Business logic layer
│   │   ├── auth.service.js        # register, login, google OAuth, JWT/refresh tokens
│   │   ├── transaction.service.js # CRUD + FX conversion + budget alert trigger
│   │   ├── budget.service.js      # CRUD + live spend + email alerts (deduped)
│   │   ├── category.service.js    # CRUD + soft-delete
│   │   └── report.service.js      # monthly, categoryBreakdown, netWorth, dashboard
│   │
│   ├── repositories/              # Raw SQL — no business logic
│   │   ├── user.repository.js
│   │   ├── transaction.repository.js
│   │   ├── budget.repository.js
│   │   └── category.repository.js
│   │
│   ├── validators/                # Joi schemas
│   │   ├── auth.validators.js
│   │   ├── transaction.validators.js
│   │   ├── budget.validators.js
│   │   └── category.validators.js
│   │
│   ├── jobs/
│   │   ├── fxRefresh.js           # node-cron: refresh exchange_rates every 6h
│   │   └── budgetNotify.js        # node-cron: monthly summary emails on 1st
│   │
│   └── utils/
│       ├── logger.js              # Winston — JSON in prod, coloured in dev
│       ├── currency.js            # getRate, convert, toINR, formatCurrency
│       └── email.js               # Nodemailer wrapper + HTML email templates
│
├── migrations/
│   ├── migrate.js                 # Migration runner (tracks applied files)
│   ├── 001_users.sql              # users, refresh_tokens
│   ├── 002_categories.sql         # categories (with soft-delete)
│   ├── 003_transactions.sql       # transactions (NUMERIC(15,2), FX-converted field)
│   ├── 004_budgets.sql            # budgets, budget_alerts (dedup index)
│   └── 005_exchange_rates.sql     # exchange_rates (seeded with static INR rates)
│
├── tests/
│   ├── unit/
│   │   └── currency.test.js       # formatCurrency unit tests
│   └── integration/
│       └── auth.test.js           # Supertest: register, login, health
│
├── uploads/                       # Created at runtime — receipt files stored here
├── .env.example
├── package.json
└── README.md
```

---

## API Reference

### Auth — `/api/auth`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | — | Register with email + password |
| POST | `/login` | — | Login, returns accessToken |
| POST | `/refresh` | Cookie | Refresh access token |
| POST | `/logout` | Cookie | Revoke refresh token |
| GET | `/google` | — | Redirect to Google OAuth |
| GET | `/google/callback` | — | OAuth callback |
| GET | `/me` | JWT | Get current user |
| PUT | `/me` | JWT | Update profile / preferences |

### Transactions — `/api/transactions`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List (filter: type, currency, search, dateFrom, dateTo, page, limit) |
| GET | `/:id` | Get by ID |
| POST | `/` | Create (multipart/form-data, optional receipt file) |
| PUT | `/:id` | Update |
| DELETE | `/:id` | Delete |

### Budgets — `/api/budgets`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all with live spend & pct |
| POST | `/` | Create budget goal |
| PUT | `/:id` | Update budget |
| DELETE | `/:id` | Remove budget |

### Reports — `/api/reports`
| Method | Path | Query params | Description |
|--------|------|------|-------------|
| GET | `/dashboard` | currency | Current month summary |
| GET | `/monthly` | year, currency | Month-by-month income/expense/investment |
| GET | `/category-breakdown` | year, currency | Spend grouped by category |
| GET | `/net-worth` | year, currency | Running net worth by month |

### Categories — `/api/categories`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List (filter: ?type=income|expense|investment) |
| POST | `/` | Create |
| PUT | `/:id` | Update |
| DELETE | `/:id` | Soft-delete (transactions preserved) |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Min 32-char secret for signing access tokens |
| `REFRESH_TOKEN_SECRET` | ✅ | Secret for refresh tokens |
| `GOOGLE_CLIENT_ID` | OAuth | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth | e.g. `http://localhost:5000/api/auth/google/callback` |
| `SMTP_HOST` | Email | e.g. `smtp.gmail.com` |
| `SMTP_USER` | Email | Gmail address or SMTP user |
| `SMTP_PASS` | Email | App password (Gmail) or SMTP password |
| `OPENEXCHANGE_APP_ID` | FX | Free key from openexchangerates.org |

---

## Security Measures

- `helmet` — HTTP security headers (XSS, clickjacking, MIME sniffing)
- `bcryptjs` — Password hashing (12 rounds)
- **JWT access tokens** — 15 min expiry, signed HS256
- **Refresh tokens** — Hashed in DB, 7-day expiry, rotated on each use
- **Rate limiting** — 15 req/min on auth, 200 req/min on API
- **Joi validation** — All inputs validated and sanitised before reaching services
- **Parameterised SQL** — No string concatenation, immune to injection
- **Soft-delete categories** — Transactions never orphaned
- **`NUMERIC(15,2)`** — All monetary values; no IEEE 754 float errors
- **`amount_inr` column** — FX-converted base stored at transaction time; reports stay consistent even if rates change

---

## Features Checklist

### Part A — Core
- [x] User registration + login (email/password)
- [x] JWT access + refresh token rotation
- [x] Google OAuth2 (redirect flow)
- [x] Profile management (name, email, currency prefs)
- [x] Transaction CRUD — income, expense, investment
- [x] Negative amounts (refunds) fully supported
- [x] Category soft-delete — transactions preserved
- [x] `NUMERIC(15,2)` — no floating-point errors
- [x] Receipt upload — Multer, 5 MB, JPEG/PNG/PDF
- [x] Multi-currency — 7 currencies, FX rates cached in DB
- [x] Dashboard — income/expense/savings, charts
- [x] Monthly income vs expense report
- [x] Category breakdown report
- [x] Net worth trend report
- [x] Budget goals with real-time spend tracking
- [x] Budget overrun email alerts (deduped per period)
- [x] 80% budget warning emails
- [x] Monthly summary email (cron, opt-in)

### Part B — Extra Credit
- [ ] OpenAI / LLM integration
- [ ] Bank statement CSV/PDF import
- [ ] Anomaly detection
#   F i n F l o w  
 #   F i n F l o w  
 #   F J - B E - R 2 G o v i n d K u m a r - A j a y K u m a r G a r g E n g g C o l l e g e  
 