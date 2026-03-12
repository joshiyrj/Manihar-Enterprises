const AdminUser = require("../models/AdminUser");
const { verifyToken } = require("../lib/auth");

const ADMIN_COOKIE = process.env.COOKIE_NAME || "s_management_token";

async function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = verifyToken(token);
    const admin = await AdminUser.findById(decoded.adminId).lean();
    if (!admin) return res.status(401).json({ message: "Unauthorized" });

    req.admin = { id: admin._id.toString(), username: admin.username };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

module.exports = { requireAdmin };
