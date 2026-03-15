#!/bin/bash
set -e
echo "🚀 Setting up Field Command Backend..."

mkdir -p field-command-backend
cd field-command-backend
mkdir -p config middleware models routes socket

# ── .env.example ──────────────────────────────────
cat > '.env.example' << 'HEREDOC'
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/field_command

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:3000

HEREDOC

# ── README.md ──────────────────────────────────
cat > 'README.md' << 'HEREDOC'
# Field Command — Backend API

Node.js + Express + MongoDB + Socket.io backend for the Field Command Sales Intelligence Dashboard.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# 3. Seed database with sample data
npm run seed

# 4. Start dev server
npm run dev

# 5. Production
npm start
```

Server runs on **http://localhost:5000**

---

## Auth

All routes (except `/api/auth/*`) require a Bearer token in the `Authorization` header.

```
Authorization: Bearer <token>
```

Roles: `manager` | `rep`  
Manager-only routes are marked with 🔒.

---

## REST API Reference

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login`    | Login → returns JWT |
| GET  | `/api/auth/me`       | Current user |

**Login body:**
```json
{ "email": "manager@fieldcommand.com", "password": "manager123" }
```

---

### Reps `/api/reps`
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/api/reps`                  | any     | All reps (manager) or own profile |
| GET    | `/api/reps/:id`              | any     | Single rep |
| PATCH  | `/api/reps/:id/status`       | any     | Update status (visiting/idle/traveling) |
| PATCH  | `/api/reps/:id/location`     | any     | Update GPS + battery |
| PATCH  | `/api/reps/:id/order`        | any     | Log a new order |
| PATCH  | `/api/reps/:id`              | 🔒 mgr  | Edit territory / target |

**Status update body:**
```json
{ "status": "visiting", "currentClient": "TechVision Solutions" }
```

**Order body:**
```json
{ "revenue": 45000, "clientName": "TechVision Solutions" }
```

---

### Activities `/api/activities`
| Method | Route | Description |
|--------|-------|-------------|
| GET  | `/api/activities?limit=20&type=order&repId=...` | Activity feed |
| POST | `/api/activities` | Manually create activity |

---

### Tasks `/api/tasks`
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/api/tasks?repId=...&status=pending` | any    | List tasks |
| POST   | `/api/tasks`         | 🔒 mgr | Assign task to rep |
| PATCH  | `/api/tasks/:id/done`| any    | Mark task complete |
| DELETE | `/api/tasks/:id`     | 🔒 mgr | Delete task |

**Assign task body:**
```json
{
  "repId": "<rep_id>",
  "task": { "id": "t1", "label": "Client Follow-up", "icon": "📞", "desc": "...", "priority": "high" },
  "deadline": "17:00",
  "note": "Focus on overdue accounts"
}
```

---

### Expenses `/api/expenses`
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/api/expenses?repId=...&status=pending` | any    | List expenses |
| POST   | `/api/expenses`          | any    | Log expense |
| PATCH  | `/api/expenses/:id/approve` | 🔒 mgr | Approve |
| PATCH  | `/api/expenses/:id/reject`  | 🔒 mgr | Reject |

**Log expense body:**
```json
{
  "repId": "<rep_id>",
  "amount": 500,
  "category": { "id": "travel", "label": "Travel", "icon": "🚗", "color": "#ffba08" },
  "note": "Cab to client site"
}
```

---

### Meetings `/api/meetings`
| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/api/meetings?repId=...` | List meetings |
| POST   | `/api/meetings`           | Schedule meeting |
| PATCH  | `/api/meetings/:id`       | Update status/outcome |

**Schedule body:**
```json
{
  "repId": "<rep_id>",
  "type": { "id": "demo", "label": "Product Demo", "icon": "🎯" },
  "client": "Acme Corp",
  "time": "15:30",
  "notes": "Bring demo kit"
}
```

---

### Notifications `/api/notifications`
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET    | `/api/notifications?repId=...` | any    | List notifications |
| POST   | `/api/notifications`           | 🔒 mgr | Send to one rep |
| POST   | `/api/notifications/broadcast` | 🔒 mgr | Send to multiple reps |
| PATCH  | `/api/notifications/:id/read`  | any    | Mark as read |

**Broadcast body:**
```json
{ "repIds": ["<id1>", "<id2>"], "msg": "⚠️ Check in immediately!" }
```

---

### Reports `/api/reports`
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/reports/daily`  | 🔒 mgr | Full daily summary |
| GET | `/api/reports/hourly` | 🔒 mgr | Hourly visit/order breakdown |

---

## Socket.io Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `rep:join`      | `repId`                  | Rep joins their room |
| `manager:join`  | —                        | Manager joins manager room |
| `rep:ping`      | `{ repId, lat, lng, battery }` | Live GPS update |
| `rep:idle_tick` | `{ repId, idleMinutes }` | Periodic idle update |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `rep:status`     | `{ repId, status, currentClient }` | Status changed |
| `rep:location`   | `{ repId, lat, lng, battery }`     | Location updated |
| `rep:idle_update`| `{ repId, idleMinutes }`           | Idle time synced |
| `rep:order`      | `{ repId, orders, revenue }`       | New order placed |
| `activity:new`   | Activity object                    | New feed item |
| `task:assigned`  | Task object                        | Task assigned |
| `task:done`      | `{ taskId }`                       | Task completed |
| `expense:new`    | Expense object                     | Expense logged |
| `expense:approved`| `{ expenseId }`                   | Expense approved |
| `meeting:new`    | Meeting object                     | Meeting scheduled |
| `notification:received` | `{ msg, isBroadcast }`    | Notification for rep |
| `notification:new`      | Notification object       | Notification created |
| `broadcast:sent` | `{ count, msg }`                   | Broadcast confirmed |

---

## Project Structure

```
field-command-backend/
├── server.js           # Entry point
├── .env.example        # Environment config template
├── middleware/
│   └── auth.js         # JWT protect + managerOnly
├── models/
│   ├── User.js         # Users (managers + reps)
│   ├── Rep.js          # Rep live profile
│   ├── Activity.js     # Live feed entries
│   ├── Task.js         # Assigned tasks
│   ├── Expense.js      # Expense logs
│   ├── Meeting.js      # Scheduled meetings
│   └── Notification.js # Notifications
├── routes/
│   ├── auth.js
│   ├── reps.js
│   ├── activities.js
│   ├── tasks.js
│   ├── expenses.js
│   ├── meetings.js
│   ├── notifications.js
│   └── reports.js
├── socket/
│   └── events.js       # Socket.io event handlers
└── config/
    └── seed.js         # Sample data seeder
```

## Seed Credentials

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@fieldcommand.com | manager123 |
| Rep (Rajesh) | rajesh@fieldcommand.com | rep123 |
| Rep (Priya)  | priya@fieldcommand.com  | rep123 |
| Rep (Amit)   | amit@fieldcommand.com   | rep123 |
| Rep (Sneha)  | sneha@fieldcommand.com  | rep123 |
| Rep (Vikram) | vikram@fieldcommand.com | rep123 |
| Rep (Neha)   | neha@fieldcommand.com   | rep123 |

HEREDOC

# ── config/seed.js ──────────────────────────────────
cat > 'config/seed.js' << 'HEREDOC'
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
require("dotenv").config({ path: "../.env" });

const User     = require("../models/User");
const Rep      = require("../models/Rep");
const Activity = require("../models/Activity");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/field_command";

const SEED_USERS = [
  { name: "Admin Manager", email: "manager@fieldcommand.com", password: "manager123", role: "manager" },
  { name: "Rajesh Kumar",  email: "rajesh@fieldcommand.com",  password: "rep123", role: "rep", territory: "North Zone",   phone: "+91 98765 11111" },
  { name: "Priya Sharma",  email: "priya@fieldcommand.com",   password: "rep123", role: "rep", territory: "East Zone",    phone: "+91 98765 22222" },
  { name: "Amit Patel",    email: "amit@fieldcommand.com",    password: "rep123", role: "rep", territory: "South Zone",   phone: "+91 98765 33333" },
  { name: "Sneha Desai",   email: "sneha@fieldcommand.com",   password: "rep123", role: "rep", territory: "West Zone",    phone: "+91 98765 44444" },
  { name: "Vikram Singh",  email: "vikram@fieldcommand.com",  password: "rep123", role: "rep", territory: "Central Zone", phone: "+91 98765 55555" },
  { name: "Neha Verma",    email: "neha@fieldcommand.com",    password: "rep123", role: "rep", territory: "South-East",   phone: "+91 98765 66666" },
];

const REP_STATS = [
  { status: "visiting",  currentClient: "TechVision Solutions", visits: 4, orders: 2, target: 6, revenue: 45000, battery: 78, lastCheckIn: "10:45 AM", location: { lat: 28.7041, lng: 77.1025 } },
  { status: "idle",      currentClient: null,                   visits: 2, orders: 1, target: 6, revenue: 18500, battery: 45, lastCheckIn: "12:30 PM", idleMinutes: 145, location: { lat: 22.5726, lng: 88.3639 } },
  { status: "visiting",  currentClient: "Global Traders",       visits: 5, orders: 4, target: 5, revenue: 72000, battery: 92, lastCheckIn: "2:15 PM",  location: { lat: 13.0827, lng: 80.2707 } },
  { status: "traveling", currentClient: null,                   visits: 3, orders: 2, target: 5, revenue: 31000, battery: 67, lastCheckIn: "1:45 PM",  location: { lat: 19.0760, lng: 72.8777 } },
  { status: "idle",      currentClient: null,                   visits: 1, orders: 0, target: 5, revenue: 8000,  battery: 23, lastCheckIn: "11:00 AM", idleMinutes: 180, location: { lat: 23.2599, lng: 77.4126 } },
  { status: "visiting",  currentClient: "Sunrise Corp",         visits: 6, orders: 5, target: 6, revenue: 89000, battery: 88, lastCheckIn: "2:45 PM",  location: { lat: 17.3850, lng: 78.4867 } },
];

const seed = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // Wipe existing data
  await Promise.all([User.deleteMany(), Rep.deleteMany(), Activity.deleteMany()]);
  console.log("Cleared existing data");

  // Create users
  const createdUsers = await Promise.all(
    SEED_USERS.map((u) => User.create(u))
  );
  console.log(`Created ${createdUsers.length} users`);

  // Create rep profiles for rep users
  const repUsers = createdUsers.filter((u) => u.role === "rep");
  const createdReps = await Promise.all(
    repUsers.map((user, i) => {
      const stats = REP_STATS[i];
      const efficiency = Math.round(
        Math.min((stats.visits / stats.target) * 50, 50) +
        (stats.visits > 0 ? (stats.orders / stats.visits) * 50 : 0)
      );
      return Rep.create({
        user: user._id,
        name: user.name,
        initials: user.name.split(" ").map((w) => w[0]).join("").toUpperCase(),
        territory: user.territory,
        phone: user.phone,
        efficiency,
        ...stats,
      });
    })
  );
  console.log(`Created ${createdReps.length} rep profiles`);

  // Seed some activities
  const activities = [
    { rep: "Neha Verma",   repI: "NV", action: "Order Placed",    client: "Sunrise Corp",         value: "₹89,000", type: "order",   icon: "💰" },
    { rep: "Rajesh Kumar", repI: "RK", action: "Client Check-in", client: "TechVision Solutions", value: "—",       type: "checkin", icon: "📍" },
    { rep: "Amit Patel",   repI: "AP", action: "Order Placed",    client: "Global Traders",        value: "₹72,000", type: "order",   icon: "💰" },
    { rep: "Sneha Desai",  repI: "SD", action: "En Route",        client: "Next location",         value: "—",       type: "travel",  icon: "🚗" },
    { rep: "Priya Sharma", repI: "PS", action: "Visit Completed", client: "Metro Enterprises",     value: "₹18,500", type: "visit",   icon: "✓"  },
  ];

  await Activity.insertMany(activities);
  console.log(`Created ${activities.length} activities`);

  console.log("\n✅  Seed complete!");
  console.log("   Manager login → manager@fieldcommand.com / manager123");
  console.log("   Rep login     → rajesh@fieldcommand.com  / rep123\n");

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

HEREDOC

# ── middleware/auth.js ──────────────────────────────────
cat > 'middleware/auth.js' << 'HEREDOC'
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized — no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// Manager-only access
const managerOnly = (req, res, next) => {
  if (req.user?.role !== "manager") {
    return res.status(403).json({ success: false, message: "Manager access required" });
  }
  next();
};

module.exports = { protect, managerOnly };

HEREDOC

# ── models/Activity.js ──────────────────────────────────
cat > 'models/Activity.js' << 'HEREDOC'
const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    rep:    { type: String, required: true },
    repId:  { type: mongoose.Schema.Types.ObjectId, ref: "Rep" },
    repI:   { type: String },
    action: { type: String, required: true },
    client: { type: String, default: "—" },
    value:  { type: String, default: "—" },
    type:   {
      type: String,
      enum: ["order", "checkin", "travel", "visit", "notify", "assign", "expense", "meeting"],
      required: true,
    },
    icon:   { type: String, default: "📍" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Activity", activitySchema);

HEREDOC

# ── models/Expense.js ──────────────────────────────────
cat > 'models/Expense.js' << 'HEREDOC'
const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    repId:   { type: mongoose.Schema.Types.ObjectId, ref: "Rep", required: true },
    repName: { type: String },
    amount:  { type: Number, required: true, min: 0 },
    category: {
      id:    { type: String, enum: ["travel", "food", "client", "other"] },
      label: String,
      icon:  String,
      color: String,
    },
    note:   { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", expenseSchema);

HEREDOC

# ── models/Meeting.js ──────────────────────────────────
cat > 'models/Meeting.js' << 'HEREDOC'
const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    repId:   { type: mongoose.Schema.Types.ObjectId, ref: "Rep", required: true },
    repName: { type: String },
    type: {
      id:    String,
      label: String,
      icon:  String,
    },
    client:  { type: String, required: true },
    time:    { type: String, required: true },
    notes:   { type: String, default: "" },
    status:  { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },
    outcome: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meeting", meetingSchema);

HEREDOC

# ── models/Notification.js ──────────────────────────────────
cat > 'models/Notification.js' << 'HEREDOC'
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    repId:    { type: mongoose.Schema.Types.ObjectId, ref: "Rep", required: true },
    repName:  { type: String },
    sentBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    msg:      { type: String, required: true },
    isBroadcast: { type: Boolean, default: false },
    read:     { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);

HEREDOC

# ── models/Rep.js ──────────────────────────────────
cat > 'models/Rep.js' << 'HEREDOC'
const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  lat: Number,
  lng: Number,
}, { _id: false });

const repSchema = new mongoose.Schema(
  {
    user:          { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name:          { type: String, required: true },
    initials:      { type: String },
    territory:     { type: String, default: "" },
    phone:         { type: String, default: "" },
    status:        { type: String, enum: ["visiting", "idle", "traveling"], default: "idle" },
    currentClient: { type: String, default: null },
    location:      { type: locationSchema, default: { lat: 0, lng: 0 } },
    battery:       { type: Number, default: 100, min: 0, max: 100 },
    lastCheckIn:   { type: String, default: "" },
    idleMinutes:   { type: Number, default: 0 },

    // Daily stats (reset each day)
    visits:    { type: Number, default: 0 },
    orders:    { type: Number, default: 0 },
    target:    { type: Number, default: 6 },
    revenue:   { type: Number, default: 0 },
    efficiency:{ type: Number, default: 0 },
  },
  { timestamps: true }
);

// Recalculate efficiency whenever visits/orders change
repSchema.methods.recalcEfficiency = function () {
  const visitScore  = Math.min((this.visits / this.target) * 50, 50);
  const orderScore  = this.visits > 0 ? (this.orders / this.visits) * 50 : 0;
  this.efficiency   = Math.round(visitScore + orderScore);
};

module.exports = mongoose.model("Rep", repSchema);

HEREDOC

# ── models/Task.js ──────────────────────────────────
cat > 'models/Task.js' << 'HEREDOC'
const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    repId:    { type: mongoose.Schema.Types.ObjectId, ref: "Rep", required: true },
    repName:  { type: String },
    repI:     { type: String },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    task: {
      id:    String,
      label: String,
      icon:  String,
      desc:  String,
      priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    },
    deadline: { type: String },
    note:     { type: String, default: "" },
    status:   { type: String, enum: ["pending", "done"], default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);

HEREDOC

# ── models/User.js ──────────────────────────────────
cat > 'models/User.js' << 'HEREDOC'
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true },
    password:  { type: String, required: true, minlength: 6 },
    role:      { type: String, enum: ["manager", "rep"], default: "rep" },
    initials:  { type: String, maxlength: 3 },
    territory: { type: String, default: "" },
    phone:     { type: String, default: "" },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  // Auto-generate initials
  if (!this.initials) {
    this.initials = this.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 3);
  }
  next();
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("User", userSchema);

HEREDOC

# ── package.json ──────────────────────────────────
cat > 'package.json' << 'HEREDOC'
{
  "name": "field-command-backend",
  "version": "1.0.0",
  "description": "Field Command Sales Intelligence Dashboard - Backend API",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "seed": "node config/seed.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-validator": "^7.0.1",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.0.3",
    "morgan": "^1.10.0",
    "socket.io": "^4.6.2",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}

HEREDOC

# ── routes/activities.js ──────────────────────────────────
cat > 'routes/activities.js' << 'HEREDOC'
const express  = require("express");
const router   = express.Router();
const Activity = require("../models/Activity");
const { protect } = require("../middleware/auth");

// GET /api/activities?limit=20&type=order
router.get("/", protect, async (req, res) => {
  try {
    const { limit = 20, type, repId } = req.query;
    const filter = {};
    if (type)  filter.type  = type;
    if (repId) filter.repId = repId;

    const activities = await Activity.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ success: true, count: activities.length, data: activities });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/activities  — Manually create activity
router.post("/", protect, async (req, res) => {
  try {
    const activity = await Activity.create(req.body);
    req.app.get("io").emit("activity:new", activity);
    res.status(201).json({ success: true, data: activity });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

HEREDOC

# ── routes/auth.js ──────────────────────────────────
cat > 'routes/auth.js' << 'HEREDOC'
const express = require("express");
const router  = express.Router();
const jwt     = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User    = require("../models/User");
const Rep     = require("../models/Rep");
const { protect } = require("../middleware/auth");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

// POST /api/auth/register
router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 6 }).withMessage("Password min 6 chars"),
    body("role").optional().isIn(["manager", "rep"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, email, password, role, territory, phone } = req.body;

    try {
      if (await User.findOne({ email })) {
        return res.status(409).json({ success: false, message: "Email already registered" });
      }

      const user = await User.create({ name, email, password, role: role || "rep", territory, phone });

      // If rep, create Rep profile
      if (user.role === "rep") {
        await Rep.create({
          user: user._id,
          name: user.name,
          initials: user.initials,
          territory: territory || "",
          phone: phone || "",
        });
      }

      res.status(201).json({
        success: true,
        token: signToken(user._id),
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// POST /api/auth/login
router.post(
  "/login",
  [
    body("email").isEmail(),
    body("password").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user || !(await user.matchPassword(password))) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      res.json({
        success: true,
        token: signToken(user._id),
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;

HEREDOC

# ── routes/expenses.js ──────────────────────────────────
cat > 'routes/expenses.js' << 'HEREDOC'
const express  = require("express");
const router   = express.Router();
const Expense  = require("../models/Expense");
const Rep      = require("../models/Rep");
const Activity = require("../models/Activity");
const { protect, managerOnly } = require("../middleware/auth");

// GET /api/expenses
router.get("/", protect, async (req, res) => {
  try {
    const { repId, status, category } = req.query;
    const filter = {};
    if (repId)    filter.repId             = repId;
    if (status)   filter.status            = status;
    if (category) filter["category.id"]    = category;

    const expenses = await Expense.find(filter).sort({ createdAt: -1 });

    const total = expenses.reduce((s, e) => s + e.amount, 0);
    res.json({ success: true, count: expenses.length, total, data: expenses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/expenses
router.post("/", protect, async (req, res) => {
  const { repId, amount, category, note } = req.body;
  try {
    const rep = await Rep.findById(repId);
    if (!rep) return res.status(404).json({ success: false, message: "Rep not found" });

    const expense = await Expense.create({ repId, repName: rep.name, amount, category, note });

    await Activity.create({
      rep: rep.name, repId: rep._id, repI: rep.initials,
      action: "Expense Logged", client: category.label,
      value: `₹${amount}`, type: "expense", icon: "💳",
    });

    req.app.get("io").emit("expense:new", expense);
    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/expenses/:id/approve  — Manager approves
router.patch("/:id/approve", protect, managerOnly, async (req, res) => {
  try {
    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      { status: "approved", approvedBy: req.user._id },
      { new: true }
    );
    if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });
    req.app.get("io").emit("expense:approved", { expenseId: expense._id });
    res.json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/expenses/:id/reject
router.patch("/:id/reject", protect, managerOnly, async (req, res) => {
  try {
    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );
    res.json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

HEREDOC

# ── routes/meetings.js ──────────────────────────────────
cat > 'routes/meetings.js' << 'HEREDOC'
const express  = require("express");
const router   = express.Router();
const Meeting  = require("../models/Meeting");
const Rep      = require("../models/Rep");
const Activity = require("../models/Activity");
const { protect } = require("../middleware/auth");

// GET /api/meetings
router.get("/", protect, async (req, res) => {
  try {
    const { repId, status } = req.query;
    const filter = {};
    if (repId)  filter.repId  = repId;
    if (status) filter.status = status;

    const meetings = await Meeting.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: meetings.length, data: meetings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/meetings
router.post("/", protect, async (req, res) => {
  const { repId, type, client, time, notes } = req.body;
  try {
    const rep = await Rep.findById(repId);
    if (!rep) return res.status(404).json({ success: false, message: "Rep not found" });

    const meeting = await Meeting.create({ repId, repName: rep.name, type, client, time, notes });

    await Activity.create({
      rep: rep.name, repId: rep._id, repI: rep.initials,
      action: "Meeting Scheduled", client,
      value: time, type: "meeting", icon: "📅",
    });

    req.app.get("io").emit("meeting:new", meeting);
    res.status(201).json({ success: true, data: meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/meetings/:id  — Update status or outcome
router.patch("/:id", protect, async (req, res) => {
  const { status, outcome } = req.body;
  try {
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      { ...(status && { status }), ...(outcome && { outcome }) },
      { new: true }
    );
    if (!meeting) return res.status(404).json({ success: false, message: "Meeting not found" });
    res.json({ success: true, data: meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

HEREDOC

# ── routes/notifications.js ──────────────────────────────────
cat > 'routes/notifications.js' << 'HEREDOC'
const express      = require("express");
const router       = express.Router();
const Notification = require("../models/Notification");
const Rep          = require("../models/Rep");
const Activity     = require("../models/Activity");
const { protect, managerOnly } = require("../middleware/auth");

// GET /api/notifications
router.get("/", protect, async (req, res) => {
  try {
    const { repId } = req.query;
    const filter = repId ? { repId } : {};
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, count: notifications.length, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notifications  — Send to one rep
router.post("/", protect, managerOnly, async (req, res) => {
  const { repId, msg } = req.body;
  try {
    const rep = await Rep.findById(repId);
    if (!rep) return res.status(404).json({ success: false, message: "Rep not found" });

    const notification = await Notification.create({ repId, repName: rep.name, sentBy: req.user._id, msg });

    await Activity.create({
      rep: rep.name, repId: rep._id, repI: rep.initials,
      action: "Notified by Manager",
      client: msg.length > 40 ? msg.slice(0, 40) + "…" : msg,
      value: "—", type: "notify", icon: "🔔",
    });

    // Push to the specific rep's socket room
    req.app.get("io").to(`rep:${repId}`).emit("notification:received", { msg });
    req.app.get("io").emit("notification:new", notification);

    res.status(201).json({ success: true, data: notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notifications/broadcast  — Send to multiple reps
router.post("/broadcast", protect, managerOnly, async (req, res) => {
  const { repIds, msg } = req.body;
  if (!Array.isArray(repIds) || repIds.length === 0) {
    return res.status(400).json({ success: false, message: "repIds must be a non-empty array" });
  }

  try {
    const reps = await Rep.find({ _id: { $in: repIds } });
    const notifications = await Notification.insertMany(
      reps.map((rep) => ({ repId: rep._id, repName: rep.name, sentBy: req.user._id, msg, isBroadcast: true }))
    );

    // Emit to each rep's socket room
    reps.forEach((rep) => {
      req.app.get("io").to(`rep:${rep._id}`).emit("notification:received", { msg, isBroadcast: true });
    });
    req.app.get("io").emit("broadcast:sent", { count: reps.length, msg });

    res.status(201).json({ success: true, count: notifications.length, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", protect, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    res.json({ success: true, data: notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

HEREDOC

# ── routes/reports.js ──────────────────────────────────
cat > 'routes/reports.js' << 'HEREDOC'
const express  = require("express");
const router   = express.Router();
const Rep      = require("../models/Rep");
const Expense  = require("../models/Expense");
const Task     = require("../models/Task");
const Meeting  = require("../models/Meeting");
const Activity = require("../models/Activity");
const { protect, managerOnly } = require("../middleware/auth");

// GET /api/reports/daily  — Full daily summary
router.get("/daily", protect, managerOnly, async (req, res) => {
  try {
    const reps     = await Rep.find();
    const expenses = await Expense.find();
    const tasks    = await Task.find();
    const meetings = await Meeting.find();

    const totalRevenue  = reps.reduce((s, r) => s + r.revenue, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalVisits   = reps.reduce((s, r) => s + r.visits, 0);
    const totalOrders   = reps.reduce((s, r) => s + r.orders, 0);

    const topPerformers = [...reps]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
      .map((r) => ({ name: r.name, revenue: r.revenue, orders: r.orders, efficiency: r.efficiency }));

    const expenseByCategory = ["travel", "food", "client", "other"].map((cat) => ({
      category: cat,
      total: expenses.filter((e) => e.category?.id === cat).reduce((s, e) => s + e.amount, 0),
    }));

    res.json({
      success: true,
      data: {
        date: new Date().toLocaleDateString(),
        summary: {
          totalReps:      reps.length,
          activeReps:     reps.filter((r) => r.status === "visiting").length,
          idleReps:       reps.filter((r) => r.status === "idle").length,
          totalVisits,
          totalOrders,
          conversionRate: totalVisits > 0 ? ((totalOrders / totalVisits) * 100).toFixed(1) : "0.0",
          totalRevenue,
          totalExpenses,
          netRevenue:     totalRevenue - totalExpenses,
          avgEfficiency:  Math.round(reps.reduce((s, r) => s + r.efficiency, 0) / (reps.length || 1)),
        },
        topPerformers,
        expenseByCategory,
        tasksCompleted: tasks.filter((t) => t.status === "done").length,
        tasksPending:   tasks.filter((t) => t.status === "pending").length,
        meetingsScheduled: meetings.filter((m) => m.status === "scheduled").length,
        meetingsCompleted: meetings.filter((m) => m.status === "completed").length,
        repDetails: reps.map((r) => ({
          name: r.name, territory: r.territory, status: r.status,
          visits: r.visits, orders: r.orders, revenue: r.revenue,
          efficiency: r.efficiency, battery: r.battery,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reports/hourly  — Hourly activity breakdown
router.get("/hourly", protect, managerOnly, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activities = await Activity.find({ createdAt: { $gte: today } });

    const hours = Array.from({ length: 10 }, (_, i) => {
      const hour = i + 9; // 9AM to 6PM
      const label = hour < 12 ? `${hour}AM` : hour === 12 ? "12PM" : `${hour - 12}PM`;
      const inHour = activities.filter((a) => {
        const h = new Date(a.createdAt).getHours();
        return h === hour;
      });
      return {
        hour: label,
        visits: inHour.filter((a) => a.type === "checkin").length,
        orders: inHour.filter((a) => a.type === "order").length,
      };
    });

    res.json({ success: true, data: hours });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

HEREDOC

# ── routes/reps.js ──────────────────────────────────
cat > 'routes/reps.js' << 'HEREDOC'
const express  = require("express");
const router   = express.Router();
const Rep      = require("../models/Rep");
const Activity = require("../models/Activity");
const { protect, managerOnly } = require("../middleware/auth");

// GET /api/reps  — All reps (manager) or own profile (rep)
router.get("/", protect, async (req, res) => {
  try {
    const query = req.user.role === "manager" ? {} : { user: req.user._id };
    const reps  = await Rep.find(query).populate("user", "email");
    res.json({ success: true, count: reps.length, data: reps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/reps/:id
router.get("/:id", protect, async (req, res) => {
  try {
    const rep = await Rep.findById(req.params.id).populate("user", "email name");
    if (!rep) return res.status(404).json({ success: false, message: "Rep not found" });
    res.json({ success: true, data: rep });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/reps/:id/status  — Rep updates own status
router.patch("/:id/status", protect, async (req, res) => {
  const { status, currentClient } = req.body;
  const validStatuses = ["visiting", "idle", "traveling"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  try {
    const rep = await Rep.findById(req.params.id);
    if (!rep) return res.status(404).json({ success: false, message: "Rep not found" });

    const prevStatus = rep.status;
    rep.status = status;
    rep.currentClient = status === "visiting" ? (currentClient || rep.currentClient) : null;

    // Reset idle timer when becoming active
    if (status !== "idle") rep.idleMinutes = 0;

    // Count a new visit when transitioning from traveling -> visiting
    if (prevStatus === "traveling" && status === "visiting") {
      rep.visits += 1;
      rep.recalcEfficiency();
    }

    rep.lastCheckIn = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    await rep.save();

    // Emit real-time update
    req.app.get("io").emit("rep:status", { repId: rep._id, status, currentClient: rep.currentClient });

    // Log activity
    const icons = { visiting: "📍", idle: "⏸", traveling: "🚗" };
    await Activity.create({
      rep: rep.name, repId: rep._id, repI: rep.initials,
      action: status === "visiting" ? "Client Check-in" : status === "traveling" ? "En Route" : "Went Idle",
      client: rep.currentClient || "—",
      value: "—",
      type: status === "visiting" ? "checkin" : "travel",
      icon: icons[status],
    });

    res.json({ success: true, data: rep });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/reps/:id/location  — Rep updates GPS location
router.patch("/:id/location", protect, async (req, res) => {
  const { lat, lng, battery } = req.body;
  try {
    const rep = await Rep.findByIdAndUpdate(
      req.params.id,
      { location: { lat, lng }, ...(battery !== undefined && { battery }) },
      { new: true }
    );
    if (!rep) return res.status(404).json({ success: false, message: "Rep not found" });

    // Broadcast location to all managers
    req.app.get("io").emit("rep:location", { repId: rep._id, lat, lng, battery: rep.battery });

    res.json({ success: true, data: { location: rep.location, battery: rep.battery } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/reps/:id/order  — Rep logs a new order
router.patch("/:id/order", protect, async (req, res) => {
  const { revenue, clientName } = req.body;
  try {
    const rep = await Rep.findById(req.params.id);
    if (!rep) return res.status(404).json({ success: false, message: "Rep not found" });

    rep.orders  += 1;
    rep.revenue += Number(revenue) || 0;
    rep.recalcEfficiency();
    await rep.save();

    await Activity.create({
      rep: rep.name, repId: rep._id, repI: rep.initials,
      action: "Order Placed",
      client: clientName || rep.currentClient || "—",
      value: `₹${Number(revenue).toLocaleString()}`,
      type: "order", icon: "💰",
    });

    req.app.get("io").emit("rep:order", { repId: rep._id, orders: rep.orders, revenue: rep.revenue });
    res.json({ success: true, data: rep });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/reps/:id  — Manager updates rep profile
router.patch("/:id", protect, managerOnly, async (req, res) => {
  const allowed = ["territory", "phone", "target", "battery"];
  const updates = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  try {
    const rep = await Rep.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!rep) return res.status(404).json({ success: false, message: "Rep not found" });
    res.json({ success: true, data: rep });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

HEREDOC

# ── routes/tasks.js ──────────────────────────────────
cat > 'routes/tasks.js' << 'HEREDOC'
const express  = require("express");
const router   = express.Router();
const Task     = require("../models/Task");
const Rep      = require("../models/Rep");
const Activity = require("../models/Activity");
const { protect, managerOnly } = require("../middleware/auth");

// GET /api/tasks
router.get("/", protect, async (req, res) => {
  try {
    const { repId, status } = req.query;
    const filter = {};
    if (repId)  filter.repId  = repId;
    if (status) filter.status = status;

    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/tasks  — Manager assigns task
router.post("/", protect, managerOnly, async (req, res) => {
  const { repId, task, deadline, note } = req.body;
  try {
    const rep = await Rep.findById(repId);
    if (!rep) return res.status(404).json({ success: false, message: "Rep not found" });

    const newTask = await Task.create({
      repId, repName: rep.name, repI: rep.initials,
      assignedBy: req.user._id,
      task, deadline, note,
    });

    // Move rep from idle to traveling
    if (rep.status === "idle") {
      rep.status = "traveling";
      rep.idleMinutes = 0;
      rep.currentClient = task.label;
      await rep.save();
      req.app.get("io").emit("rep:status", { repId: rep._id, status: "traveling" });
    }

    await Activity.create({
      rep: rep.name, repId: rep._id, repI: rep.initials,
      action: "Task Assigned", client: task.label,
      value: `Due ${deadline}`, type: "assign", icon: "📋",
    });

    req.app.get("io").emit("task:assigned", newTask);
    res.status(201).json({ success: true, data: newTask });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/tasks/:id/done
router.patch("/:id/done", protect, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, { status: "done" }, { new: true });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    req.app.get("io").emit("task:done", { taskId: task._id });
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete("/:id", protect, managerOnly, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

HEREDOC

# ── server.js ──────────────────────────────────
cat > 'server.js' << 'HEREDOC'
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const app = express();
const httpServer = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Make io accessible in routes
app.set("io", io);

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",         require("./routes/auth"));
app.use("/api/reps",         require("./routes/reps"));
app.use("/api/activities",   require("./routes/activities"));
app.use("/api/tasks",        require("./routes/tasks"));
app.use("/api/expenses",     require("./routes/expenses"));
app.use("/api/meetings",     require("./routes/meetings"));
app.use("/api/notifications",require("./routes/notifications"));
app.use("/api/reports",      require("./routes/reports"));

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ── Socket.io Events ─────────────────────────────────────────────────────────
require("./socket/events")(io);

// ── MongoDB + Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/field_command")
  .then(() => {
    console.log("✅  MongoDB connected");
    httpServer.listen(PORT, () => {
      console.log(`🚀  Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌  MongoDB connection error:", err.message);
    process.exit(1);
  });

HEREDOC

# ── socket/events.js ──────────────────────────────────
cat > 'socket/events.js' << 'HEREDOC'
const Rep = require("../models/Rep");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌  Socket connected: ${socket.id}`);

    // Rep joins their personal room (so managers can send targeted notifications)
    socket.on("rep:join", (repId) => {
      socket.join(`rep:${repId}`);
      console.log(`👤  Rep ${repId} joined their room`);
    });

    // Manager joins manager room
    socket.on("manager:join", () => {
      socket.join("managers");
      console.log(`🧑‍💼  Manager joined managers room`);
    });

    // Rep sends a live location ping
    socket.on("rep:ping", async ({ repId, lat, lng, battery }) => {
      try {
        await Rep.findByIdAndUpdate(repId, { location: { lat, lng }, battery });
        // Broadcast to all managers
        io.to("managers").emit("rep:location", { repId, lat, lng, battery });
      } catch (err) {
        console.error("rep:ping error:", err.message);
      }
    });

    // Rep reports idle time (sent periodically from frontend)
    socket.on("rep:idle_tick", async ({ repId, idleMinutes }) => {
      try {
        await Rep.findByIdAndUpdate(repId, { idleMinutes });
        io.to("managers").emit("rep:idle_update", { repId, idleMinutes });
      } catch (err) {
        console.error("rep:idle_tick error:", err.message);
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌  Socket disconnected: ${socket.id}`);
    });
  });
};

HEREDOC

echo ""
echo "✅  All files created!"
echo ""
echo "📦  Installing dependencies..."
npm install
echo ""
echo "⚙️   Creating .env from example..."
cp .env.example .env
echo ""
echo "🎉  Done! Next steps:"
echo "    1. Edit .env and set your MONGO_URI"
echo "    2. Run: npm run seed"
echo "    3. Run: npm run dev"
echo ""