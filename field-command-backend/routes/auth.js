const express = require("express");
const router  = express.Router();
const jwt     = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User    = require("../models/User");
const Rep     = require("../models/Rep");
const { protect } = require("../middleware/auth");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

// POST /api/auth/register
router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 6 }).withMessage("Password min 6 chars"),
    body("role").optional().isIn(["manager", "rep"]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, email, password, role, territory, phone } = req.body;

    try {
      if (await User.findOne({ email })) {
        return res.status(409).json({ success: false, message: "Email already registered" });
      }

      const user = await User.create({ name, email, password, role: role || "rep", territory, phone });

      // If rep, create Rep profile
      if (user.role === "rep") {
        await Rep.create({
          user: user._id,
          name: user.name,
          initials: user.initials,
          territory: territory || "",
          phone: phone || "",
        });
      }

      res.status(201).json({
        success: true,
        token: signToken(user._id),
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// POST /api/auth/login
router.post(
  "/login",
  [
    body("email").isEmail(),
    body("password").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user || !(await user.matchPassword(password))) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      res.json({
        success: true,
        token: signToken(user._id),
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;

