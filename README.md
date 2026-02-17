# ✈ Aviator — Crash Betting Game

A full-stack Aviator (crash) betting game built with **Django REST Framework** and **React**. Players place bets before a plane takes off, watch a multiplier rise, and cash out before the plane flies away. The longer you wait, the more you win — but if the plane flies away before you cash out, you lose your bet.

This project is designed as a **learning reference** for building real-time games with a React frontend consuming a Django REST API.

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [How the Game Works](#-how-the-game-works)
- [Backend — File by File](#-backend--file-by-file)
- [Frontend — File by File](#-frontend--file-by-file)
- [API Reference](#-api-reference)
- [Installation & Setup](#-installation--setup)
- [Running the Application](#-running-the-application)
- [Using the Application](#-using-the-application)
- [Architecture Decisions](#-architecture-decisions)
- [Production Checklist](#-production-checklist)

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | Django 4.x + Django REST Framework |
| Authentication | JWT via `djangorestframework-simplejwt` |
| Database | SQLite (dev) / PostgreSQL (prod) |
| CORS | `django-cors-headers` |
| Payment | M-Pesa Daraja API (STK Push + B2C) |
| Frontend framework | React 18 + Vite |
| HTTP client | Axios (with JWT interceptors) |
| Styling | Pure CSS-in-JS (no external UI library) |
| Font | Orbitron + Rajdhani (Google Fonts) |

---

## 📁 Project Structure

```
aviator_project/
│
├── README.md                        ← You are here
│
├── backend/                         ← Django app files (copy into your Django project)
│   ├── models.py                    ← Database models for all entities
│   ├── serializers.py               ← DRF serializers + input validation
│   ├── viewsets.py                  ← API logic — all endpoints as ViewSets
│   ├── admin.py                     ← Django admin configuration
│   ├── urls.py                      ← App-level URL router (uses DRF Router)
│   ├── project_urls.py              ← Root urls.py for the Django project
│   ├── game_engine.py               ← Standalone game loop (runs as management cmd)
│   └── utils.py                     ← Helpers: M-Pesa, crash point, reference gen
│
└── frontend/                        ← React + Vite application
    ├── index.html                   ← HTML entry point
    ├── package.json                 ← Node dependencies
    ├── vite.config.js               ← Vite config + /api proxy to Django
    └── src/
        ├── main.jsx                 ← React app mount point + global CSS reset
        ├── App.jsx                  ← Root: auth guard + bottom navigation shell
        │
        ├── api/
        │   └── api.js               ← Axios instance + every API call, organized by domain
        │
        ├── store/
        │   └── AuthContext.jsx      ← React Context: login / register / logout / balance
        │
        ├── components/
        │   └── AviatorGame.jsx      ← Main game screen (canvas, bets, chat, bet panel)
        │
        └── pages/
            ├── AuthPages.jsx        ← LoginPage + RegisterPage components
            ├── WalletPage.jsx       ← Deposit / Withdraw / Transaction history
            └── ProfilePage.jsx      ← User stats / Bet history / Leaderboard
```

---

## 🎮 How the Game Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ROUND LIFECYCLE                             │
│                                                                     │
│   ① WAITING (5 sec)     ② FLYING             ③ CRASHED            │
│   ┌─────────────┐       ┌─────────────┐       ┌─────────────┐      │
│   │ Place bets  │──────▶│ Multiplier  │──────▶│ Round over  │      │
│   │ before      │       │ rises 1.00x │       │ Losses      │      │
│   │ takeoff!    │       │ → crash pt  │       │ settled     │      │
│   └─────────────┘       └─────────────┘       └─────────────┘      │
│                               │                      │             │
│                          Cash out                    ↓             │
│                          anytime!              2 sec pause         │
│                                                      │             │
│                                               Back to ①            │
└─────────────────────────────────────────────────────────────────────┘
```

1. The **game engine** generates a secret crash point (e.g. 3.47x) and creates a new round with `status = 'waiting'`.
2. Players have **5 seconds** to place bets. Each bet is deducted from their balance immediately.
3. The engine starts flying — the multiplier climbs from **1.00x** upward using an exponential formula.
4. Players manually **cash out** by clicking the button, or set an **auto-cashout** target beforehand.
5. When the multiplier reaches the crash point, the plane "flies away". Any uncashed bets are lost.
6. The cycle repeats immediately.

The **React frontend polls `/api/game/current/` every 300ms** to get the live multiplier. For production, this should be replaced with a WebSocket (Django Channels) for real-time push updates.

---

## 🔧 Backend — File by File

### `models.py`

Defines all database tables. Key models:

| Model | Description |
|-------|-------------|
| `User` | Custom auth user — phone number as username, `balance` + `bonus_balance` fields |
| `GameRound` | One round of the game: `status`, `multiplier`, crash point stored before round |
| `Bet` | A single bet: `amount`, `cashout_multiplier`, `payout`, `status`, `auto_cashout` |
| `Transaction` | Audit log of every balance movement (deposit, win, bet, withdrawal, bonus) |
| `ChatMessage` | Live chat messages per user, or system messages (`is_system=True`) |
| `Rain` | Bonus promotions where a pool of money is split among participants |
| `UserStatistics` | Aggregated stats per user (total bets, wins, biggest multiplier, win rate) |
| `MpesaPayment` | M-Pesa STK push request and callback data linked to a Transaction |
| `SystemSettings` | Key/value store for configurable game settings (min bet, maintenance mode) |

### `serializers.py`

DRF serializers for every model and standalone input serializers for form validation. Key ones:

| Serializer | Used for |
|------------|----------|
| `RegisterSerializer` | Validates registration including password confirmation match |
| `LoginSerializer` | Authenticates phone + password, attaches `user` to `validated_data` |
| `PlaceBetSerializer` | Validates bet amount (10–50,000 KES) + optional `auto_cashout` |
| `CashoutSerializer` | Validates `bet_id` (UUID) + `multiplier` (min 1.00) |
| `DepositSerializer` | Validates deposit amount (10–300,000 KES) + optional phone number |
| `ActiveBetSerializer` | Minimal bet data for live game display, phone numbers masked |
| `UserBetSerializer` | Full bet data for user's personal history including crash point |
| `LeaderboardSerializer` | Public player stats with all identifying info masked |

### `viewsets.py`

Six ViewSets replace all old function-based views. Each uses `@action` decorators:

| ViewSet | Actions |
|---------|---------|
| `AuthViewSet` | `register`, `login`, `logout`, `me`, `update_profile` |
| `GameViewSet` | `current`, `history`, `bet`, `cashout`, `my_bet`, `my_history` |
| `TransactionViewSet` | `balance`, `list_transactions`, `deposit`, `complete_deposit`, `withdraw`, `check_deposit_status` |
| `ChatViewSet` | `messages`, `send` |
| `RainViewSet` | `active`, `join` |
| `LeaderboardViewSet` | `top` |

All balance-changing operations use `db_transaction.atomic()` + `select_for_update()` to prevent race conditions when multiple requests arrive simultaneously.

### `admin.py`

Registered admin classes for every model with:
- Colored status badges (green/red/orange) using `format_html`
- Search by phone number, reference, and receipt number
- Currency formatting (`KES X,XXX.XX`) in list columns
- Read-only fields for auto-generated data (ID, timestamps)

### `urls.py`

Uses DRF's `DefaultRouter` to auto-generate all URL patterns from the six ViewSets. One router registration per ViewSet produces all the correct REST URLs automatically.

### `game_engine.py`

A standalone Python class (`AviatorGameEngine`) that runs in an infinite loop:

```
create_round() → waiting_phase(5s) → flying_phase() → crash() → 2s pause → repeat
```

Run it as a Django management command in a separate terminal from the web server. It:
- Writes multiplier updates to the database on every tick (every 0.1 seconds)
- Processes auto-cashouts on each tick before checking the crash point
- Settles all remaining active bets as `lost` when the round crashes
- Sends system chat messages at the start and end of each round

### `utils.py`

| Function | Description |
|----------|-------------|
| `generate_reference()` | Unique transaction ID like `AV20240115120000AB12CD34` |
| `determine_crash_point()` | Weighted random crash (30% below 2x, 30% at 2–5x, 25% at 5–10x, etc.) |
| `generate_provably_fair_result()` | SHA-256 based crash using server seed + client seed + nonce |
| `calculate_multiplier(elapsed)` | `e^(0.06 × t)` — exponential curve matching the visual game animation |
| `process_mpesa_payment()` | Initiates M-Pesa STK push to customer's phone |
| `process_b2c_withdrawal()` | Sends M-Pesa B2C payment for withdrawals |
| `mask_phone_number()` | `+254712345678` → `5678****` for public display |

---

## 🎨 Frontend — File by File

### `api/api.js`

Single Axios instance used by all components. Handles:
- Attaching `Authorization: Bearer <token>` to every outgoing request
- Automatic **token refresh** on 401 responses — retries the original request silently
- Redirect to login page if refresh token is also expired
- Organized named exports: `authAPI`, `gameAPI`, `transactionAPI`, `chatAPI`, `leaderboardAPI`

### `store/AuthContext.jsx`

React Context that wraps the entire app. Exposes:

```js
const { user, loading, login, register, logout, refreshBalance } = useAuth();
```

- `user` — current user object with balance fields, or `null` if logged out
- `loading` — `true` while checking stored token on first mount
- `refreshBalance()` — silently fetches fresh balance without a full page reload
- On mount, uses stored access token to restore session automatically

### `components/AviatorGame.jsx`

The main game screen. Contains four sub-parts:

| Part | Description |
|------|-------------|
| `GameCanvas` | HTML5 Canvas: draws the live multiplier curve with glow, gradient fill, Y-axis labels, using `requestAnimationFrame` |
| `Plane` | Animated SVG plane with flame exhaust effects (turns red and tilts on crash) |
| `HistoryBadge` | Color-coded multiplier chips: red < 1.5x, orange < 2x, green > 2x, blue > 5x, purple > 10x |
| Game logic | Polls `/api/game/current/` every 300ms; manages bet state, cashout state, notifications |

The **bet panel** shows either a BET button (during waiting phase) or a CASHOUT button (during flying phase with an active bet). The button state is computed from `status`, `userBet`, and loading flags.

### `pages/AuthPages.jsx`

Two components sharing a common `AuthLayout` wrapper:
- `LoginPage` — Phone number + password, links to register
- `RegisterPage` — Phone + name + password + confirm, displays welcome bonus notice

Both show inline error messages from the API response without page reload.

### `pages/WalletPage.jsx`

Three-tab layout accessed from the bottom navigation:

| Tab | Description |
|-----|-------------|
| DEPOSIT | Amount input → STK push → confirm/cancel payment dialog (simulated M-Pesa) |
| WITHDRAW | Amount input → instant withdrawal to M-Pesa (simulated) |
| HISTORY | Chronological list of all transactions with type icons and colored status badges |

### `pages/ProfilePage.jsx`

Three-tab layout:

| Tab | Description |
|-----|-------------|
| STATS | Cards for total bets, wins, win rate, biggest multiplier, wagered, won, and net P&L |
| HISTORY | Every bet placed — shows round number, crash point, cashout multiplier, and payout |
| LEADERS | Top 10 players by total winnings with all phone numbers masked for privacy |

### `App.jsx`

Top-level component that:
1. Shows a loading spinner while auth state resolves on first mount
2. Shows Login or Register if user is not authenticated
3. Renders the main app with a fixed bottom navigation bar (Game / Wallet / Profile)
4. Adds 56px bottom padding so content is never hidden behind the nav bar

---

## 🔌 API Reference

All endpoints are under `/api/`. All except `register` and `login` require:
```
Authorization: Bearer <access_token>
```

### Auth

| Method | URL | Body | Response |
|--------|-----|------|----------|
| POST | `/api/auth/register/` | `phone_number, password, confirm_password, full_name` | `tokens, user` |
| POST | `/api/auth/login/` | `phone_number, password` | `tokens, user` |
| POST | `/api/auth/logout/` | `refresh` | `success` |
| GET  | `/api/auth/me/` | — | `user` (includes statistics) |
| PATCH | `/api/auth/update_profile/` | `full_name` | `user` |

### Game

| Method | URL | Body / Params | Response |
|--------|-----|--------------|----------|
| GET | `/api/game/current/` | — | `round, bets[], user_bet` |
| GET | `/api/game/history/` | `?limit=20` | `history[]` |
| POST | `/api/game/bet/` | `amount, auto_cashout?` | `bet, balance` |
| POST | `/api/game/cashout/` | `bet_id, multiplier` | `payout, multiplier, balance` |
| GET | `/api/game/my_bet/` | — | `bet` or `null` |
| GET | `/api/game/my_history/` | `?limit=20&offset=0` | `bets[], total, has_more` |

### Transactions

| Method | URL | Body / Params | Response |
|--------|-----|--------------|----------|
| GET | `/api/transactions/balance/` | — | `balance, bonus_balance, total_balance` |
| GET | `/api/transactions/list_transactions/` | `?limit=20&offset=0&type=` | `transactions[], total` |
| POST | `/api/transactions/deposit/` | `amount, phone_number?` | `transaction_id, checkout_request_id` |
| POST | `/api/transactions/complete_deposit/` | `transaction_id, success` | `new_balance, mpesa_receipt` |
| POST | `/api/transactions/withdraw/` | `amount, phone_number?` | `balance, reference` |
| GET | `/api/transactions/check_deposit_status/` | `?transaction_id=` | `status, mpesa_status` |

### Chat, Rain & Leaderboard

| Method | URL | Body / Params | Response |
|--------|-----|--------------|----------|
| GET | `/api/chat/messages/` | `?limit=50` | `messages[]` |
| POST | `/api/chat/send/` | `message` | `message` |
| GET | `/api/rain/active/` | — | `rains[]` |
| POST | `/api/rain/join/` | `rain_id` | `success` |
| GET | `/api/leaderboard/top/` | `?limit=10` | `leaders[]` |

### JWT Token Utilities

| Method | URL | Body |
|--------|-----|------|
| POST | `/api/token/refresh/` | `refresh` → new `access` token |
| POST | `/api/token/verify/` | `token` → validates token |

---

## 🚀 Installation & Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- pip

### Step 1 — Create Django project

```bash
django-admin startproject myproject
cd myproject
python manage.py startapp aviator
```

### Step 2 — Copy backend files

Copy all files from `backend/` into the `aviator/` app:

```
myproject/
└── aviator/
    ├── __init__.py         (already exists)
    ├── models.py           ← backend/models.py
    ├── serializers.py      ← backend/serializers.py
    ├── viewsets.py         ← backend/viewsets.py
    ├── admin.py            ← backend/admin.py
    ├── urls.py             ← backend/urls.py
    ├── game_engine.py      ← backend/game_engine.py
    └── utils.py            ← backend/utils.py
```

Copy the contents of `backend/project_urls.py` into `myproject/urls.py`.

Create the management command files:

```bash
mkdir -p aviator/management/commands
touch aviator/management/__init__.py
touch aviator/management/commands/__init__.py
```

Create `aviator/management/commands/run_game_engine.py`:

```python
from django.core.management.base import BaseCommand
from aviator.game_engine import AviatorGameEngine

class Command(BaseCommand):
    help = 'Run the Aviator game engine'

    def handle(self, *args, **options):
        engine = AviatorGameEngine()
        self.stdout.write(self.style.SUCCESS('Game engine starting...'))
        engine.run()
```

### Step 3 — Install Python packages

```bash
pip install django djangorestframework djangorestframework-simplejwt \
            django-cors-headers requests
```

### Step 4 — Configure `settings.py`

```python
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    # Your app
    'aviator',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',   # ← must be FIRST
    'django.middleware.security.SecurityMiddleware',
    # ... rest unchanged
]

AUTH_USER_MODEL = 'aviator.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=12),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',   # Vite dev server
]
CORS_ALLOW_CREDENTIALS = True
```

### Step 5 — Run migrations

```bash
python manage.py makemigrations aviator
python manage.py migrate
python manage.py createsuperuser   # phone number format: +254700000001
```

### Step 6 — Set up frontend

```bash
cd frontend
npm install
```

---

## ▶️ Running the Application

You need **three terminals** running at the same time:

**Terminal 1 — Django web server:**
```bash
python manage.py runserver
# API available at:  http://localhost:8000/api/
# Admin panel at:    http://localhost:8000/admin/
```

**Terminal 2 — Game engine:**
```bash
python manage.py run_game_engine
# Output example:
# [Engine] 🚀 Aviator Game Engine started
# [Engine] Round 1 created | crash @ 3.47x
# [Engine] Waiting 5s for bets...
# [Engine] Activated 2 bets
# [Engine] ✈  Flying!
# [Engine] 💥 Crashed @ 3.47x
```

**Terminal 3 — React frontend:**
```bash
cd frontend
npm run dev
# App available at: http://localhost:3000
```

> The game engine **must be running** for rounds to be created. Without it, the frontend shows "No active round" indefinitely.

---

## 📖 Using the Application

### Registering an account

1. Open `http://localhost:3000`
2. Click **Register**
3. Enter phone number in format `+254712345678`, your name, and a password
4. A **KES 50 welcome bonus** is added to your account automatically
5. You are logged in immediately and land on the game screen

### Playing the game

1. You land on the **Game** tab (✈ icon, bottom navigation)
2. The **history bar** at the top shows crash multipliers from recent rounds — use these to judge risk
3. When you see `PREPARING...` and the betting countdown, the round is in the waiting phase
4. Enter a **bet amount** in the input (min KES 10, max KES 50,000)
5. Optionally set an **Auto Cashout** value — e.g. entering `2.00` will automatically cash you out the moment the multiplier hits 2x
6. Click **✈ BET** — your balance is deducted immediately
7. Once the plane starts flying, watch the multiplier climb
8. Click **💰 CASHOUT X.XXx** at any time to lock in your winnings
9. If you don't cash out before the crash, you lose the bet amount
10. Winnings are added to your balance instantly after cashout

### Depositing funds

1. Go to **Wallet** tab (💳 icon)
2. Select the **DEPOSIT** tab
3. Enter the amount (min KES 10) — tap quick-select buttons or type manually
4. Click **📲 SEND STK PUSH**
5. A simulated M-Pesa prompt appears — click **✓ PAID** to complete
6. Your balance updates immediately on screen

### Withdrawing funds

1. Go to **Wallet** → **WITHDRAW** tab
2. Enter amount (min KES 100) — only main balance is withdrawable, not bonus
3. Optionally enter a different phone number, or leave blank to use your account number
4. Click **↑ WITHDRAW** — funds are processed immediately (simulated)

### Viewing transaction history

1. Go to **Wallet** → **HISTORY** tab
2. See all deposits, withdrawals, bets, wins, and bonuses in chronological order
3. Each entry shows type icon, description, timestamp, amount (+/-), and status

### Viewing your stats

1. Go to **Profile** tab (👤 icon)
2. **STATS** — win rate, total wagered, total won, biggest multiplier ever hit, net profit/loss
3. **HISTORY** — every bet you've placed, showing the round's crash point, your cashout multiplier (if you won), and final payout
4. **LEADERS** — top 10 players by total winnings (all phone numbers are masked to last 4 digits)

---

## 🏛 Architecture Decisions

**ViewSets over function-based views** — ViewSets group related logic together. `GameViewSet` contains `bet`, `cashout`, `current`, `history` — all game actions in one class. DRF's router auto-generates clean URL patterns from one registration line.

**JWT over session cookies** — React is a SPA. Session cookies work poorly with cross-origin setups. JWT tokens are stored in `localStorage`, attached to every request by Axios interceptors, and silently refreshed on expiry.

**Polling over WebSockets** — `setInterval` every 300ms is simpler to build and understand. For production with many users, replace with Django Channels WebSocket to push multiplier updates directly to all connected clients.

**Separate `bonus_balance` and `balance` fields** — Bonus funds can be used for betting but cannot be withdrawn. Keeping them as separate fields avoids complex logic to track which balance is "real". Bets consume bonus first, then main balance.

**`select_for_update()` on all financial writes** — Every operation that reads then writes a balance locks the database row at DB level. Two simultaneous cashout requests cannot both read the same balance and both credit a win.

---

## ✅ Production Checklist

| Item | Notes |
|------|-------|
| `DEBUG = False` | Never run with `True` in production |
| Strong `SECRET_KEY` | Generate with `python -c "import secrets; print(secrets.token_hex(50))"` |
| `ALLOWED_HOSTS` | Set to your actual domain name |
| PostgreSQL | Replace SQLite — much better for concurrent game load |
| Real M-Pesa credentials | Set `MPESA_ENVIRONMENT = 'production'` with live keys |
| Provably fair | Swap `determine_crash_point()` for `generate_provably_fair_result()` |
| Django Channels + Redis | Replace 300ms polling with WebSocket push from game engine |
| Supervisor or systemd | Keep game engine running as background service with auto-restart |
| nginx | Serve React `dist/` as static files; proxy `/api/` to Django/Gunicorn |
| HTTPS | Required by M-Pesa for callback URLs |
| Rate limiting | Add `throttle_classes` to bet/cashout ViewSets to prevent abuse |

---

## 🧑‍💻 Learning Concepts Covered

| Concept | Where to look |
|---------|--------------|
| Custom User model (`AbstractBaseUser`) | `models.py` → `User`, `UserManager` |
| DRF ViewSets + Router URL auto-generation | `viewsets.py`, `urls.py` |
| DRF Serializers for validation (not just model representation) | `serializers.py` → `PlaceBetSerializer`, `CashoutSerializer` |
| JWT authentication flow in React | `api/api.js` (interceptors), `store/AuthContext.jsx` |
| React Context for global state | `store/AuthContext.jsx`, `App.jsx` |
| Polling for real-time data with cleanup | `AviatorGame.jsx` → `useEffect` + `setInterval` + `clearInterval` |
| HTML5 Canvas animation with `requestAnimationFrame` | `AviatorGame.jsx` → `GameCanvas` component |
| Atomic DB operations to prevent race conditions | `viewsets.py` → `bet()`, `cashout()`, `complete_deposit()` |
| Django admin customization with colored badges | `admin.py` |
| Vite proxy to Django API (no CORS in dev) | `vite.config.js` |