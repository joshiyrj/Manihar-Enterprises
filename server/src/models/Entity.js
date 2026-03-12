const mongoose = require("mongoose");

const EntitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["item", "collection"], required: true },

    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },

    tags: [{ type: String }],

    sortOrder: { type: Number, default: 0 },

    // ✅ Item → Collection linking (collection is also an Entity)
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Entity", default: null },
    collectionName: { type: String, default: "" }
  },
  { timestamps: true }
);

EntitySchema.index({ type: 1, name: 1 });
EntitySchema.index({ type: 1, status: 1 });
EntitySchema.index({ type: 1, collectionId: 1 });

module.exports = mongoose.model("Entity", EntitySchema);