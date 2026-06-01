# TechDeals.KE — ICT Accessories Store

A full-stack web app to post and browse ICT accessories, built for Mombasa, Kenya.

## Tech Stack
- **Backend**: Node.js + Express.js
- **Frontend**: Vanilla HTML/CSS/JavaScript (served by Express)
- **Image uploads**: Multer
- **Storage**: In-memory (swap with MongoDB/MySQL for production)

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Start the server
```bash
npm start
# or for development with auto-reload:
npm run dev
```

### 3. Open in browser
```
http://localhost:5000
```

---

## 📁 Project Structure

```
ict-store/
├── backend/
│   ├── server.js         ← Express API + serves frontend
│   ├── package.json
│   └── uploads/          ← Product images (auto-created)
└── frontend/
    └── public/
        └── index.html    ← Full frontend UI
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/products | List all products (filter/search/sort) |
| GET | /api/products/:id | Get single product |
| POST | /api/products | Create product (multipart/form-data) |
| PUT | /api/products/:id | Update product |
| DELETE | /api/products/:id | Delete product |
| GET | /api/categories | List all categories |

### Query Parameters for GET /api/products
- `category` — filter by category name
- `search` — search in name/description
- `sort` — `newest`, `price_asc`, `price_desc`

---

## ✏️ Customize Your Contact Details

In `frontend/public/index.html`, update these placeholders:

```
+254 712 345 678        → Your phone number
techdealskenya@gmail.com → Your email
254712345678            → Your WhatsApp number (for wa.me links)
Mombasa, Kenya          → Your location
```

In `backend/server.js`, update the seed data `whatsapp` field similarly.

---

## 🗄️ Add a Real Database (Production)

Replace the `let products = [...]` array in `server.js` with:
- **MongoDB** via Mongoose
- **MySQL/PostgreSQL** via Sequelize or Prisma
- **Firebase Firestore**

---

## 📦 Deploy

1. **VPS (DigitalOcean/Linode)**: Run with `pm2 start server.js`
2. **Railway / Render**: Push repo, set start command to `node backend/server.js`
3. **Heroku**: Add Procfile with `web: node backend/server.js`
