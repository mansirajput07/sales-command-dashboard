const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    repId:    { type: mongoose.Schema.Types.ObjectId, ref: "Rep", required: true },
    repName:  { type: String },
    sentBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    msg:      { type: String, required: true },
    isBroadcast: { type: Boolean, default: false },
    read:     { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);

