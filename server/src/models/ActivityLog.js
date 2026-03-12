const mongoose = require("mongoose");

const ActivityLogSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    action: {
        type: String,
        required: true,
        enum: ["login", "logout", "create", "update", "delete", "export", "bulk_update", "bulk_delete", "assistant"]
    },
    entityType: { type: String }, // item, collection, profile
    entityId: { type: mongoose.Schema.Types.ObjectId },
    entityName: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    createdAt: { type: Date, default: Date.now }
});

ActivityLogSchema.index({ adminId: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1 });

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
