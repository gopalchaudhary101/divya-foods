# Divya Foods

An imported foods marketplace — frozen seafood, Japanese groceries, imported meats, cheese, and gourmet goods — with delivery across Delhi NCR.

**Live demo:** [divya-foods.vercel.app](https://divya-foods.vercel.app)

<!-- ## Screenshots
Add screenshots/GIFs here, e.g.:
![Home page](docs/screenshots/home.png)
![Product listing](docs/screenshots/products.png)
![Checkout](docs/screenshots/checkout.png)
![Admin dashboard](docs/screenshots/admin-dashboard.png)
-->

## Tech Stack

**Frontend**
- React 18 + TypeScript, built with Vite
- Tailwind CSS
- Redux Toolkit (global state) + TanStack React Query (server state)
- React Router
- React Hook Form + Zod (validation)
- Axios
- Framer Motion (animation)
- Recharts (admin analytics charts)
- Vite PWA plugin (installable app, push notifications)
- Vitest + React Testing Library

**Backend**
- FastAPI (Python)
- MongoDB via PyMongo
- JWT auth (python-jose) + bcrypt password hashing
- Razorpay (payments)
- Cloudinary (image hosting)
- SMTP email (order/delivery notifications)
- Web Push via VAPID (pywebpush)
- ReportLab (PDF invoices) + qrcode (order QR codes)
- Anthropic API (AI chat assistant)
- slowapi (rate limiting)
- Pytest + httpx (test suite)

**Deployment:** Frontend on Vercel, backend on Railway, database on MongoDB Atlas.

## Features

- Product catalog with categories, search, and rating-based filtering
- Product detail pages with reviews, ratings, and Q&A (verified-purchase gated)
- Cart and checkout with Razorpay payment integration
- Guest checkout, delivery slot selection, and bulk ordering
- Order tracking with delivery status stepper and QR codes
- PDF invoice generation
- Coupons, bundle deals, and flash sales
- Loyalty points and membership tiers
- Gift cards and referral rewards
- Wishlist
- Subscriptions (recurring orders)
- User authentication (register/login/forgot & reset password) with JWT access + refresh tokens
- Customer roles: customer, driver, and admin
- Driver dashboard for delivery-scoped order management
- Admin dashboard: products, orders (with bulk actions), users, coupons, bundles, banners, gift cards, inventory, drivers, analytics, and site settings
- In-app admin role management (promote/demote customer, driver, admin)
- Email notifications (order confirmation, delivery updates)
- Web push notifications
- AI-powered chat assistant for customer queries
- Installable PWA
- Auto-generated sitemap
- Rate-limited API endpoints

## Local Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- A MongoDB Atlas cluster (or local MongoDB instance)

### 1. Clone the repo
```bash
git clone https://github.com/gopalchaudhary101/divya-foods.git
cd divya-foods
```

### 2. Frontend setup
```bash
npm install
cp .env.example .env
# fill in the values in .env
npm run dev
```

### 3. Backend setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env
# fill in the values in .env
uvicorn app.main:app --reload
```

The frontend runs at `http://localhost:5173` and the backend API at `http://localhost:8000`.

See [DEPLOY.md](DEPLOY.md) for production deployment instructions.

## Author

**Gopal Chaudhary** — [@gopalchaudhary101](https://github.com/gopalchaudhary101)
