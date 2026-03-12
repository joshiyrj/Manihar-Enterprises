const express = require("express");
const router = express.Router();
const Entity = require("../models/Entity");
const { requireAdmin } = require("../middlewares/requireAdmin");

router.use(requireAdmin);

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveCollection({ collectionId, collectionName }) {
  // Existing selection
  if (collectionId) {
    const col = await Entity.findOne({ _id: collectionId, type: "collection" }).lean();
    if (!col) throw new Error("Invalid collection selected");
    return { collectionId: col._id, collectionName: col.name };
  }

  // Typed collection name
  const name = (collectionName || "").trim();
  if (!name) return { collectionId: null, collectionName: "" };

  let col = await Entity.findOne({ type: "collection", name }).lean();
  if (!col) {
    col = await Entity.create({ type: "collection", name, status: "active", sortOrder: 0 });
  }
  return { collectionId: col._id, collectionName: col.name };
}

// GET /api/entities?type=item|collection&q=&status=&sort=order|newest|oldest&collectionId=
router.get("/", async (req, res) => {
  try {
    const { type, q, status, sort, collectionId } = req.query;
    if (!type || !["item", "collection"].includes(type)) {
      return res.status(400).json({ message: "type must be item or collection" });
    }

    const filter = { type };
    const andConditions = [];

    if (status && ["active", "inactive"].includes(status)) {
      filter.status = status;
    }

    // Collection filter only for items
    if (type === "item" && collectionId) {
      if (collectionId === "__none__") {
        andConditions.push({ $or: [{ collectionId: null }, { collectionName: "" }] });
      } else {
        andConditions.push({ collectionId });
      }
    }

    if (q && q.trim()) {
      const rx = new RegExp(escapeRegExp(q.trim()), "i");
      const queryFields = [{ name: rx }, { description: rx }];
      if (type === "item") {
        queryFields.push({ collectionName: rx });
      }
      andConditions.push({ $or: queryFields });
    }

    if (andConditions.length) {
      filter.$and = andConditions;
    }

    let sortObj = { sortOrder: 1, createdAt: -1 };
    if (sort === "newest") sortObj = { createdAt: -1 };
    if (sort === "oldest") sortObj = { createdAt: 1 };
    if (sort === "order") sortObj = { sortOrder: 1, createdAt: -1 };

    const rows = await Entity.find(filter).sort(sortObj).lean();
    return res.json({ rows });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Failed to load entities" });
  }
});

// GET /api/entities/collections
router.get("/collections", async (req, res) => {
  try {
    const rows = await Entity.find({ type: "collection" })
      .sort({ name: 1 })
      .select("_id name")
      .lean();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to load collections" });
  }
});

// POST /api/entities
router.post("/", async (req, res) => {
  try {
    const payload = req.body || {};
    const { type } = payload;

    if (!type || !["item", "collection"].includes(type)) {
      return res.status(400).json({ message: "type must be item or collection" });
    }
    if (!payload.name || !String(payload.name).trim()) {
      return res.status(400).json({ message: "name is required" });
    }

    payload.name = String(payload.name).trim();
    payload.description = payload.description ? String(payload.description) : "";
    payload.status = ["active", "inactive"].includes(payload.status) ? payload.status : "active";
    payload.sortOrder = Number(payload.sortOrder || 0);
    payload.tags = Array.isArray(payload.tags) ? payload.tags : [];

    if (type === "item") {
      const link = await resolveCollection(payload);
      payload.collectionId = link.collectionId;
      payload.collectionName = link.collectionName;
    } else {
      payload.collectionId = null;
      payload.collectionName = "";
      // optional: prevent duplicate collection name
      const exists = await Entity.findOne({ type: "collection", name: payload.name }).lean();
      if (exists) return res.status(400).json({ message: "Collection with same name already exists" });
    }

    const created = await Entity.create(payload);
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to create entity" });
  }
});

// PUT /api/entities/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    const existing = await Entity.findById(id).lean();
    if (!existing) return res.status(404).json({ message: "Not found" });

    const update = {};

    if (payload.name !== undefined) update.name = String(payload.name).trim();
    if (payload.description !== undefined) update.description = String(payload.description || "");
    if (payload.status !== undefined)
      update.status = ["active", "inactive"].includes(payload.status) ? payload.status : existing.status;
    if (payload.sortOrder !== undefined) update.sortOrder = Number(payload.sortOrder || 0);
    if (payload.tags !== undefined) update.tags = Array.isArray(payload.tags) ? payload.tags : [];

    if (existing.type === "item" && (payload.collectionId !== undefined || payload.collectionName !== undefined)) {
      const link = await resolveCollection(payload);
      update.collectionId = link.collectionId;
      update.collectionName = link.collectionName;
    }

    // If updating a collection name, also update denormalized names in items
    if (existing.type === "collection" && update.name && update.name !== existing.name) {
      const dup = await Entity.findOne({ type: "collection", name: update.name, _id: { $ne: id } }).lean();
      if (dup) return res.status(400).json({ message: "Collection with same name already exists" });

      await Entity.updateMany(
        { type: "item", collectionId: existing._id },
        { $set: { collectionName: update.name } }
      );
    }

    const saved = await Entity.findByIdAndUpdate(id, update, { new: true }).lean();
    res.json(saved);
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to update entity" });
  }
});

// DELETE /api/entities/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Entity.findById(id).lean();
    if (!existing) return res.status(404).json({ message: "Not found" });

    // Professional behavior: do not delete collection if it has items
    if (existing.type === "collection") {
      const count = await Entity.countDocuments({ type: "item", collectionId: existing._id });
      if (count > 0) {
        return res.status(400).json({
          message: `Cannot delete collection. ${count} item(s) are linked to it. Move items first.`
        });
      }
    }

    await Entity.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to delete entity" });
  }
});

// POST /api/entities/bulk/status - bulk update status
router.post("/bulk/status", async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids array is required" });
    }
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "status must be active or inactive" });
    }

    const result = await Entity.updateMany(
      { _id: { $in: ids } },
      { $set: { status } }
    );

    res.json({ ok: true, modifiedCount: result.modifiedCount });
  } catch (e) {
    res.status(500).json({ message: e.message || "Bulk update failed" });
  }
});

// POST /api/entities/bulk/delete - bulk delete
router.post("/bulk/delete", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids array is required" });
    }

    // Check for collections with linked items
    const collections = await Entity.find({
      _id: { $in: ids },
      type: "collection"
    }).lean();

    for (const col of collections) {
      const linked = await Entity.countDocuments({ type: "item", collectionId: col._id });
      if (linked > 0) {
        return res.status(400).json({
          message: `Cannot delete "${col.name}" - ${linked} item(s) linked. Remove items first.`
        });
      }
    }

    const result = await Entity.deleteMany({ _id: { $in: ids } });
    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (e) {
    res.status(500).json({ message: e.message || "Bulk delete failed" });
  }
});

module.exports = router;
