/*
====================================================
TRP — AUTH PERMISSIONS ENGINE (P3)
====================================================
*/

export function authorize(allowedRoles = []) {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      const userRole = req.user.role;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: "Forbidden: insufficient permissions",
        });
      }

      next();
    } catch (err) {
      console.error("authorize error:", err);
      return res.status(500).json({
        success: false,
        error: "Authorization error",
      });
    }
  };
}
