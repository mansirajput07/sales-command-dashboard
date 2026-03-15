const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  lat: Number,
  lng: Number,
}, { _id: false });

const repSchema = new mongoose.Schema(
  {
    user:          { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name:          { type: String, required: true },
    initials:      { type: String },
    territory:     { type: String, default: "" },
    phone:         { type: String, default: "" },
    status:        { type: String, enum: ["visiting", "idle", "traveling"], default: "idle" },
    currentClient: { type: String, default: null },
    location:      { type: locationSchema, default: { lat: 0, lng: 0 } },
    battery:       { type: Number, default: 100, min: 0, max: 100 },
    lastCheckIn:   { type: String, default: "" },
    idleMinutes:   { type: Number, default: 0 },

    // Daily stats (reset each day)
    visits:    { type: Number, default: 0 },
    orders:    { type: Number, default: 0 },
    target:    { type: Number, default: 6 },
    revenue:   { type: Number, default: 0 },
    efficiency:{ type: Number, default: 0 },
  },
  { timestamps: true }
);

// Recalculate efficiency whenever visits/orders change
repSchema.methods.recalcEfficiency = function () {
  const visitScore  = Math.min((this.visits / this.target) * 50, 50);
  const orderScore  = this.visits > 0 ? (this.orders / this.visits) * 50 : 0;
  this.efficiency   = Math.round(visitScore + orderScore);
};

module.exports = mongoose.model("Rep", repSchema);

