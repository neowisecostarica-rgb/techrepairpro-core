console.log("🔥 AUTH ROUTES ACTIVE");

import express from "express";
import db from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_dev_key";

/*
========================================
AUTH SYNC (BASE44 → SOT) 🔥 CRÍTICO
========================================
*/
router.post("/sync", async (req, res) => {
  const client = await db.connect();

  try {
    const { base44_id, email, full_name, organization_id, role } = req.body;

    if (!base44_id || !organization_id) {
      client.release();
      return res.status(400).json({
        success: false,
        error: "base44_id and organization_id are required",
      });
    }

    await client.query("BEGIN");

    /*
    ========================================
    1. BUSCAR USUARIO POR base44_id
    ========================================
    */
    let userResult = await client.query(
      `SELECT * FROM users WHERE base44_id = $1 LIMIT 1`,
      [base44_id]
    );

    let user;

    if (userResult.rows.length === 0) {
      /*
      ========================================
      CREAR USUARIO
      ========================================
      */
      const newUser = await client.query(
        `INSERT INTO users (email, full_name, base44_id)
         VALUES ($1, $2, $3)
         RETURNING id, email, full_name`,
        [email || null, full_name || null, base44_id]
      );

      user = newUser.rows[0];
    } else {
      user = userResult.rows[0];
    }

    /*
    ========================================
    2. UPSERT MEMBERSHIP
    ========================================
    */
    await client.query(
      `INSERT INTO memberships (user_id, organization_id, role, is_active)
       VALUES ($1, $2, LOWER($3), true)
       ON CONFLICT (user_id, organization_id)
       DO UPDATE SET role = EXCLUDED.role`,
      [user.id, organization_id, role || "admin"]
    );

    /*
    ========================================
    3. OBTENER MEMBERSHIP
    ========================================
    */
    const membershipResult = await client.query(
      `SELECT * FROM memberships
       WHERE user_id = $1 AND organization_id = $2
       LIMIT 1`,
      [user.id, organization_id]
    );

    const membership = membershipResult.rows[0];

    /*
    ========================================
    4. GENERAR JWT
    ========================================
    */
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

    await client.query("COMMIT");

    return res.json({
      success: true,
      token,
      user,
      membership,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("🔥 SYNC ROLLBACK ERROR:", rollbackError);
    }

    console.error("🔥 AUTH SYNC ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/*
========================================
LOGIN (SE MANTIENE)
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
      `SELECT * FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    const user = userResult.rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    const membershipResult = await db.query(
      `SELECT * FROM memberships
       WHERE user_id = $1 AND is_active = true
       LIMIT 1`,
      [user.id]
    );

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
      user,
      membership,
    });
  } catch (error) {
    console.error("🔥 LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/*
========================================
ME
========================================
*/
router.get("/me", (req, res) => {
  return res.json({
    success: true,
    message: "AUTH SOT READY",
  });
});

export default router;
