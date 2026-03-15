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

