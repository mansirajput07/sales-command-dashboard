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

