# Law Client

A MERN-based Law Client application for creating and managing legal agreement templates.

---

## Tech Stack

### Frontend
- Next.js
- React


### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose

---

# Project Setup

## 1. Clone Repository

```bash
git clone <repository-url>
```

```bash
cd law-client-main
```

---

# Backend Setup

Go to Backend folder

```bash
cd Backend
```

Install dependencies

```bash
npm install
```

Create a `.env` file

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
```

Start backend

```bash
npm run dev
```

or

```bash
npm start
```

Backend runs on

```
http://localhost:5000
```

Health Check

```
http://localhost:5000/health
```

---

# Frontend Setup

Open another terminal

```bash
cd Frontend
```

Install dependencies

```bash
npm install
```

Create a `.env.local` file

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Start frontend

```bash
npm run dev
```

Frontend runs on

```
http://localhost:3000
```

(or the port shown in terminal)

---

# Run Tests

Backend

```bash
cd Backend
```

```bash
npm test
```

---

# Features

- Agreement Templates
- Create Documents
- Save Documents
- Helmet Security
- Rate Limiter
- Health Check Endpoint
- Jest + Supertest Testing

---

# Folder Structure

```
law-client-main
│
├── Backend
│   ├── app.js
│   ├── index.js
│   ├── config
│   ├── routes
│   ├── controllers
│   ├── models
│   └── tests
│
└── Frontend
    ├── app
    ├── components
    ├── lib
    └── public
```