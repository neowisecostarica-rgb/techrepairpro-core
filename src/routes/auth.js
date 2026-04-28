console.log("🔥 AUTH ROUTES ACTIVE");

import express from "express";
import db from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_dev_key";

/*
========================================
REGISTER
========================================
*/
router.post("/register", async (req, res) => {
  const client = await db.connect();

  try {
    const { email, password, full_name, organization_id } = req.body;

    if (!email || !password || !organization_id) {
      client.release();

      return res.status(400).json({
        success: false,
        error: "email, password, organization_id are required",
      });
    }

    await client.query("BEGIN");

    const password_hash = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name`,
      [email, password_hash, full_name || null]
    );

    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO memberships (user_id, organization_id, role)
       VALUES ($1, $2, $3)`,
      [user.id, organization_id, "ADMIN"]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("🔥 REGISTER ROLLBACK ERROR:", rollbackError);
    }

    console.error("🔥 REGISTER ERROR FULL:", error);

    if (error.code === "23505") {
      return res.status(400).json({
        success: false,
        error: "Email already exists",
        detail: error.detail || null,
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || null,
      code: error.code || null,
    });
  } finally {
    client.release();
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

    const userResult = await db.query(
      `SELECT id, email, full_name, password_hash, is_active
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    const user = userResult.rows[0];

    if (user.is_active === false) {
      return res.status(403).json({
        success: false,
        error: "User is inactive",
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

   const membershipResult = await db.query(
  `SELECT id, user_id, organization_id, role, is_active
   FROM memberships
   WHERE user_id = $1
     AND is_active = true
   ORDER BY 
     CASE 
       WHEN role = 'owner' THEN 1
       WHEN role = 'admin' THEN 2
       ELSE 3
     END
   LIMIT 1`,
  [user.id]
);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: "No active organization assigned",
      });
    }

    const membership = membershipResult.rows[0];

    const token = jwt.sign(
      {
        user_id: user.id,
        membership_id: membership.id,
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
      membership: {
        id: membership.id,
        organization_id: membership.organization_id,
        role: membership.role,
      },
    });
  } catch (error) {
    console.error("🔥 LOGIN ERROR FULL:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || null,
      code: error.code || null,
    });
  }
});

/*
========================================
ME (TEMPORAL)
========================================
*/
router.get("/me", async (req, res) => {
  return res.json({
    success: true,
    message: "AUTH routes active. Middleware JWT comes next.",
  });
});

export default router;
