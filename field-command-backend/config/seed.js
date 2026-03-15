const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
require("dotenv").config({ path: "../.env" });

const User     = require("../models/User");
const Rep      = require("../models/Rep");
const Activity = require("../models/Activity");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/field_command";

const SEED_USERS = [
  { name: "Admin Manager", email: "manager@fieldcommand.com", password: "manager123", role: "manager" },
  { name: "Rajesh Kumar",  email: "rajesh@fieldcommand.com",  password: "rep123", role: "rep", territory: "North Zone",   phone: "+91 98765 11111" },
  { name: "Priya Sharma",  email: "priya@fieldcommand.com",   password: "rep123", role: "rep", territory: "East Zone",    phone: "+91 98765 22222" },
  { name: "Amit Patel",    email: "amit@fieldcommand.com",    password: "rep123", role: "rep", territory: "South Zone",   phone: "+91 98765 33333" },
  { name: "Sneha Desai",   email: "sneha@fieldcommand.com",   password: "rep123", role: "rep", territory: "West Zone",    phone: "+91 98765 44444" },
  { name: "Vikram Singh",  email: "vikram@fieldcommand.com",  password: "rep123", role: "rep", territory: "Central Zone", phone: "+91 98765 55555" },
  { name: "Neha Verma",    email: "neha@fieldcommand.com",    password: "rep123", role: "rep", territory: "South-East",   phone: "+91 98765 66666" },
];

const REP_STATS = [
  { status: "visiting",  currentClient: "TechVision Solutions", visits: 4, orders: 2, target: 6, revenue: 45000, battery: 78, lastCheckIn: "10:45 AM", location: { lat: 28.7041, lng: 77.1025 } },
  { status: "idle",      currentClient: null,                   visits: 2, orders: 1, target: 6, revenue: 18500, battery: 45, lastCheckIn: "12:30 PM", idleMinutes: 145, location: { lat: 22.5726, lng: 88.3639 } },
  { status: "visiting",  currentClient: "Global Traders",       visits: 5, orders: 4, target: 5, revenue: 72000, battery: 92, lastCheckIn: "2:15 PM",  location: { lat: 13.0827, lng: 80.2707 } },
  { status: "traveling", currentClient: null,                   visits: 3, orders: 2, target: 5, revenue: 31000, battery: 67, lastCheckIn: "1:45 PM",  location: { lat: 19.0760, lng: 72.8777 } },
  { status: "idle",      currentClient: null,                   visits: 1, orders: 0, target: 5, revenue: 8000,  battery: 23, lastCheckIn: "11:00 AM", idleMinutes: 180, location: { lat: 23.2599, lng: 77.4126 } },
  { status: "visiting",  currentClient: "Sunrise Corp",         visits: 6, orders: 5, target: 6, revenue: 89000, battery: 88, lastCheckIn: "2:45 PM",  location: { lat: 17.3850, lng: 78.4867 } },
];

const seed = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // Wipe existing data
  await Promise.all([User.deleteMany(), Rep.deleteMany(), Activity.deleteMany()]);
  console.log("Cleared existing data");

  // Create users
  const createdUsers = await Promise.all(
    SEED_USERS.map((u) => User.create(u))
  );
  console.log(`Created ${createdUsers.length} users`);

  // Create rep profiles for rep users
  const repUsers = createdUsers.filter((u) => u.role === "rep");
  const createdReps = await Promise.all(
    repUsers.map((user, i) => {
      const stats = REP_STATS[i];
      const efficiency = Math.round(
        Math.min((stats.visits / stats.target) * 50, 50) +
        (stats.visits > 0 ? (stats.orders / stats.visits) * 50 : 0)
      );
      return Rep.create({
        user: user._id,
        name: user.name,
        initials: user.name.split(" ").map((w) => w[0]).join("").toUpperCase(),
        territory: user.territory,
        phone: user.phone,
        efficiency,
        ...stats,
      });
    })
  );
  console.log(`Created ${createdReps.length} rep profiles`);

  // Seed some activities
  const activities = [
    { rep: "Neha Verma",   repI: "NV", action: "Order Placed",    client: "Sunrise Corp",         value: "₹89,000", type: "order",   icon: "💰" },
    { rep: "Rajesh Kumar", repI: "RK", action: "Client Check-in", client: "TechVision Solutions", value: "—",       type: "checkin", icon: "📍" },
    { rep: "Amit Patel",   repI: "AP", action: "Order Placed",    client: "Global Traders",        value: "₹72,000", type: "order",   icon: "💰" },
    { rep: "Sneha Desai",  repI: "SD", action: "En Route",        client: "Next location",         value: "—",       type: "travel",  icon: "🚗" },
    { rep: "Priya Sharma", repI: "PS", action: "Visit Completed", client: "Metro Enterprises",     value: "₹18,500", type: "visit",   icon: "✓"  },
  ];

  await Activity.insertMany(activities);
  console.log(`Created ${activities.length} activities`);

  console.log("\n✅  Seed complete!");
  console.log("   Manager login → manager@fieldcommand.com / manager123");
  console.log("   Rep login     → rajesh@fieldcommand.com  / rep123\n");

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

