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

