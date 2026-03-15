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

