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

