import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_dev_key";

export async function authenticate(req, res, next) {
  try {
    console.log("🔐 AUTH START");

    const authHeader = req.headers["authorization"];

    console.log("➡️ Authorization Header:", authHeader);

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "Authorization header required",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Token missing",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    console.log("✅ TOKEN DECODED:", decoded);

    req.user = {
      user_id: decoded.user_id,
      organization_id: decoded.organization_id,
      role: decoded.role
    };

    next();
  } catch (err) {
    console.error("🚨 AUTH ERROR FULL:", err);

    return res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
}
