/*
====================================================
TRP — AUTH CORE (SOT REAL READY)
====================================================
*/

import jwt from "jsonwebtoken";
import db from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_dev_key";

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];

    /*
    ========================================
    VALIDAR HEADER
    ========================================
    */
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Authorization Bearer token required",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Token missing",
      });
    }

    /*
    ========================================
    VERIFY TOKEN
    ========================================
    */
    const decoded = jwt.verify(token, JWT_SECRET);

    const { user_id, organization_id, role, membership_id } = decoded;

    if (!user_id || !organization_id || !role) {
      return res.status(401).json({
        success: false,
        error: "Invalid token payload",
      });
    }

    /*
    ========================================
    VALIDAR USUARIO EN BD
    ========================================
    */
    const userResult = await db.query(
      `SELECT id, is_active
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "User not found",
      });
    }

    const user = userResult.rows[0];

    if (user.is_active === false) {
      return res.status(403).json({
        success: false,
        error: "User inactive",
      });
    }

    /*
    ========================================
    VALIDAR MEMBERSHIP
    ========================================
    */
    const membershipResult = await db.query(
      `SELECT id, role, is_active
       FROM memberships
       WHERE user_id = $1
         AND organization_id = $2
       LIMIT 1`,
      [user_id, organization_id]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: "No membership found",
      });
    }

    const membership = membershipResult.rows[0];

    if (membership.is_active === false) {
      return res.status(403).json({
        success: false,
        error: "Membership inactive",
      });
    }

    /*
    ========================================
    INJECT CONTEXT
    ========================================
    */
    req.user = {
      user_id,
      organization_id,
      role: membership.role,
      membership_id: membership.id,
    };

    next();

  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
}
