const mongoose = require("mongoose");

const MillSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        location: { type: String, default: "", trim: true },
        contactPerson: { type: String, default: "", trim: true },
        phone: { type: String, default: "", trim: true },
        status: { type: String, enum: ["active", "inactive"], default: "active" },
        notes: { type: String, default: "" }
    },
    { timestamps: true }
);

MillSchema.index({ name: "text", location: "text", contactPerson: "text" });

module.exports = mongoose.model("Mill", MillSchema);
