import pool from "../db.js";

export async function authenticate(req, res, next) {
  try {
    const orgId = req.headers["x-organization-id"];

    console.log("🔐 AUTH START");
    console.log("➡️ orgId:", orgId);

    if (!orgId) {
      return res
        .status(401)
        .json({ success: false, error: "organization_id required" });
    }

    console.log("📡 Querying DB...");

    const result = await pool.query(
      "SELECT id, name FROM organizations WHERE id = $1 LIMIT 1",
      [orgId]
    );

    console.log("📊 DB RESULT:", result.rows);

    if (!result.rows.length) {
      console.log("❌ Organization not found");
      return res
        .status(401)
        .json({ success: false, error: "Invalid organization" });
    }

    req.organization = result.rows[0];

    console.log("✅ AUTH SUCCESS:", req.organization);

    next();
  } catch (err) {
    console.error("🚨 AUTH ERROR FULL:", err);

    return res.status(500).json({
      success: false,
      error: "Auth failed",
      details: err.message, // 👈 esto es clave para debug
    });
  }
}
