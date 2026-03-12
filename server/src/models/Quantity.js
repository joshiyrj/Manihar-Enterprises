const mongoose = require("mongoose");

const QuantitySchema = new mongoose.Schema(
    {
        label: { type: String, required: true, trim: true },
        value: { type: Number, required: true },
        unit: { type: String, default: "pcs", trim: true },
        category: { type: String, default: "", trim: true },
        status: { type: String, enum: ["active", "inactive"], default: "active" },
        notes: { type: String, default: "" }
    },
    { timestamps: true }
);

QuantitySchema.index({ label: "text", category: "text" });

module.exports = mongoose.model("Quantity", QuantitySchema);
