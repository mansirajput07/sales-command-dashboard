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

