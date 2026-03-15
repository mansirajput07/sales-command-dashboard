const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    repId:   { type: mongoose.Schema.Types.ObjectId, ref: "Rep", required: true },
    repName: { type: String },
    type: {
      id:    String,
      label: String,
      icon:  String,
    },
    client:  { type: String, required: true },
    time:    { type: String, required: true },
    notes:   { type: String, default: "" },
    status:  { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },
    outcome: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meeting", meetingSchema);

