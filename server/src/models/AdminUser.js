const mongoose = require("mongoose");

const AdminUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true }, // "admin"
    name: { type: String, default: "Admin" },
    email: { type: String, default: "admin@smanagement.com" },
    mobile: { type: String, default: "9999999999" },
    passwordHash: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminUser", AdminUserSchema);