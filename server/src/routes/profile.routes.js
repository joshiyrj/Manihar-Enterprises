const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const AdminUser = require("../models/AdminUser");
const { requireAdmin } = require("../middlewares/requireAdmin");

router.use(requireAdmin);

router.get("/", async (req, res) => {
  const admin = await AdminUser.findById(req.admin.id).lean();
  res.json({
    username: admin.username,
    name: admin.name,
    email: admin.email,
    mobile: admin.mobile
  });
});

const UpdateProfileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  mobile: z.string().min(8)
});

router.put("/", async (req, res, next) => {
  try {
    const data = UpdateProfileSchema.parse(req.body);
    await AdminUser.findByIdAndUpdate(req.admin.id, data, { new: true });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4)
});

router.put("/password", async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);

    const admin = await AdminUser.findById(req.admin.id);
    const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!ok) return res.status(400).json({ message: "Current password is incorrect" });

    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await admin.save();

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;