# Clara & Ezekiel — Wedding Registry & Gift Fund Platform
**In honor of Clara Napoleon Akpan & Ezekiel Asuquo Ikoh**
*Wedding Ceremony: 29th December 2026*
*Venue: The Apostolic Church Nigeria, Ekim Town District Headquarters, Ikot Abasi Field*

---

## 🌟 Overview
A luxury Nigerian wedding registry and gift fund website inspired by **Sincerely Yours** (`sincerelyyours.com.ng`), crafted with HTML5, CSS3, JavaScript, and Node.js.

### 💖 Key Features
- **Theme Palette**: Styled in a romantic, luxury **Pink and Burgundy** theme with champagne rose gold accents, soft petal ivory, and dark velvet wine typography.
- **Live Wedding Countdown**: Real-time countdown timer to 29th December 2026.
- **10 Pre-loaded Registry Items & Cash Funds**:
  1. Air conditioner — ₦300,000
  2. 4 Burner gas cooker — ₦200,000
  3. Air fryer — ₦70,000
  4. Blender — ₦120,000
  5. Pots (Cookware set) — ₦70,000
  6. Kitchen utensils — ₦40,000
  7. Decor (Wedding floral & hall decor) — ₦500,000
  8. Drinks (Refreshment bar fund) — ₦500,000
  9. Cash Gift Fund — Flexible contribution
  10. "Plenty Cash" — Special high-roller celebration fund for godparents & ballers
- **Local Display Pictures**: High-resolution photography images for each appliance/item stored locally in `public/images/`.
- **Direct Bank Transfer Flow**:
  - Prominent Nigerian Bank details card (Bank Name, Account Number, Account Name).
  - 1-Click **"Copy Account Number"** with instant clipboard feedback.
  - Unique transaction reference generator (`CE-2026-XXXX`).
  - Transfer narration instructions for guests.
  - 1-Click **WhatsApp Confirmation** link with pre-filled payment details for guests to message the couple directly with proof of payment.
- **Paystack Online Payments Ready**:
  - Full Paystack Inline JS integration + backend API stubs ready.
  - Configurable in the Admin Dashboard: Toggle online card payments ON/OFF, enter your Public Key (`pk_live_...` or `pk_test_...`) and Secret Key whenever you're ready.
- **Wedding Guestbook & Love Notes**:
  - Guests can leave sweet congratulatory prayers and messages that display in the interactive Guestbook feed.
  - Confetti celebration animation on every contribution.
- **Admin Dashboard (`/admin`)**:
  - Protected with security PIN (Default: `2026`).
  - Add new items, edit existing items, or delete items.
  - Upload custom item photos from your computer or choose presets.
  - Update Nigerian bank account details dynamically without touching code.
  - View total amount pledged/raised and list of all guest contributions.
  - Verify payments or manage guestbook messages.
  - Change ceremony details or update your access PIN.

---

## 🚀 How to Run the Website

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
The server will start on:
- **Public Wedding Registry**: [http://localhost:3000](http://localhost:3000)
- **Admin Management Portal**: [http://localhost:3000/admin](http://localhost:3000/admin) *(Default PIN: `2026`)*

---

## 🛠️ Backend API Routes

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/api/settings` | Get public wedding & bank info | Public |
| `GET` | `/api/items` | Get all registry items with raised amounts | Public |
| `GET` | `/api/items/:id` | Get single item | Public |
| `POST` | `/api/items` | Add a new registry item | Admin (`x-admin-pin`) |
| `PUT` | `/api/items/:id` | Edit item title, price, picture, status | Admin (`x-admin-pin`) |
| `DELETE` | `/api/items/:id` | Delete registry item | Admin (`x-admin-pin`) |
| `POST` | `/api/upload` | Upload image from computer | Admin (`x-admin-pin`) |
| `POST` | `/api/contributions` | Record a guest transfer/pledge & message | Public |
| `GET` | `/api/admin/contributions` | View all contributions & guest details | Admin (`x-admin-pin`) |
| `PUT` | `/api/admin/contributions/:id` | Update payment status (Verified / Pending) | Admin (`x-admin-pin`) |
| `GET` | `/api/guestbook` | Get congratulatory notes for guestbook | Public |
| `PUT` | `/api/admin/settings` | Update bank details, couple info, Paystack keys | Admin (`x-admin-pin`) |
| `POST` | `/api/paystack/initialize` | Initialize Paystack transaction | Public |
| `POST` | `/api/paystack/verify/:ref` | Verify Paystack transaction | Public |

---

## 💳 How to Activate Paystack (When Ready)
1. Go to [http://localhost:3000/admin](http://localhost:3000/admin) and enter PIN `2026`.
2. Click on **Bank & Payment Settings** in the sidebar.
3. Look at the **Paystack Payment Gateway** card.
4. Toggle **"Enable Paystack Online Card Processing"** to ON.
5. Paste your Paystack Public Key (`pk_live_...` or `pk_test_...`) and Secret Key.
6. Click **"Update Paystack Settings"**.
Guests can now pay directly with Debit Cards, USSD, or Bank Transfer in the checkout popup!
