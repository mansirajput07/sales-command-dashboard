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

