/*
====================================================
TRP — AUTH CORE (P1 + P2 + P4 READY)
====================================================
*/

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_dev_key";

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];

    // ========================================
    // VALIDAR HEADER
    // ========================================
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

    // ========================================
    // VERIFY TOKEN
    // ========================================
    const decoded = jwt.verify(token, JWT_SECRET);

    // ========================================
    // VALIDAR PAYLOAD
    // ========================================
    if (!decoded.user_id || !decoded.organization_id || !decoded.role) {
      return res.status(401).json({
        success: false,
        error: "Invalid token payload",
      });
    }

    // ========================================
    // INJECT USER CONTEXT
    // ========================================
    req.user = {
      user_id: decoded.user_id,
      organization_id: decoded.organization_id,
      role: decoded.role,
    };

    next();

  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
}
