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

