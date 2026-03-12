const mongoose = require("mongoose");

const DesignNoSchema = new mongoose.Schema(
    {
        designNumber: { type: String, required: true, unique: true, trim: true },
        title: { type: String, default: "", trim: true },
        category: { type: String, default: "", trim: true },
        color: { type: String, default: "", trim: true },
        mill: { type: String, default: "", trim: true },
        status: { type: String, enum: ["active", "inactive"], default: "active" },
        notes: { type: String, default: "" }
    },
    { timestamps: true }
);

DesignNoSchema.index({ designNumber: "text", title: "text", category: "text" });

module.exports = mongoose.model("DesignNo", DesignNoSchema);
