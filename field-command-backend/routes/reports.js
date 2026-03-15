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

