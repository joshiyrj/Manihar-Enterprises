const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        mobile: { type: String, default: "", trim: true },
        passwordHash: { type: String, required: true },
        lastPasswordChange: { type: Date, default: null },
        status: { type: String, enum: ["active", "suspended"], default: "active" }
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
