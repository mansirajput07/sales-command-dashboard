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

