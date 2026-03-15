const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    rep:    { type: String, required: true },
    repId:  { type: mongoose.Schema.Types.ObjectId, ref: "Rep" },
    repI:   { type: String },
    action: { type: String, required: true },
    client: { type: String, default: "—" },
    value:  { type: String, default: "—" },
    type:   {
      type: String,
      enum: ["order", "checkin", "travel", "visit", "notify", "assign", "expense", "meeting"],
      required: true,
    },
    icon:   { type: String, default: "📍" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Activity", activitySchema);

