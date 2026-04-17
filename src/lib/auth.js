import pool from "../db.js";

export async function authenticate(req, res, next) {
  try {
    const orgId = req.headers["x-organization-id"];

    if (!orgId) {
      return res
        .status(401)
        .json({ success: false, error: "organization_id required" });
    }

    const { rows } = await pool.query(
      `SELECT id, name FROM organizations WHERE id = $1 LIMIT 1`,
      [orgId]
    );

    if (!rows.length) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid organization" });
    }

    req.organization = rows[0];

    next();
  } catch (err) {
    console.error("AUTH ERROR:", err);
    res.status(500).json({ success: false, error: "Auth failed" });
  }
}
