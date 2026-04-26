import express from "express";
import db from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_dev_key";

/*
========================================
REGISTER
========================================
*/
router.post("/register", async (req, res) => {
  try {
    const { email, password, full_name, organization_id } = req.body;

    if (!email || !password || !organization_id) {
      return res.status(400).json({
        success: false,
        error: "email, password, organization_id are required",
      });
    }

    // hash password
    const password_hash = await bcrypt.hash(password, 10);

    // create user
    const userResult = await db.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name`,
      [email, password_hash, full_name]
    );

    const user = userResult.rows[0];

    // create membership
    await db.query(
      `INSERT INTO memberships (user_id, organization_id, role)
       VALUES ($1, $2, $3)`,
      [user.id, organization_id, "ORG_ADMIN"]
    );

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    if (error.code === "23505") {
      return res.status(400).json({
        success: false,
        error: "Email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

/*
========================================
LOGIN
========================================
*/
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "email and password are required",
      });
    }

    // find user
    const userResult = await db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    const user = userResult.rows[0];

    // compare password
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // get membership (por ahora 1 org)
    const membershipResult = await db.query(
      `SELECT * FROM memberships WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [user.id]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: "No organization assigned",
      });
    }

    const membership = membershipResult.rows[0];

    // create token
    const token = jwt.sign(
      {
        user_id: user.id,
        organization_id: membership.organization_id,
        role: membership.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

/*
========================================
ME
========================================
*/
router.get("/me", async (req, res) => {
  return res.json({
    success: true,
    message: "Use token in next phase",
  });
});

export default router;
