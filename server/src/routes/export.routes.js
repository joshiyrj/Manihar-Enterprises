const router = require("express").Router();
const { requireAdmin } = require("../middlewares/requireAdmin");
const Entity = require("../models/Entity");
const ActivityLog = require("../models/ActivityLog");

router.use(requireAdmin);

// GET /api/export/items?format=json|csv
router.get("/items", async (req, res) => {
    try {
        const rows = await Entity.find({ type: "item" }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        const format = req.query.format || "json";

        await ActivityLog.create({
            adminId: req.admin.id,
            action: "export",
            entityType: "item",
            details: { format, count: rows.length }
        });

        if (format === "csv") {
            const header = "Name,Description,Status,SortOrder,CollectionName,Tags,CreatedAt\n";
            const csv = rows.map(r =>
                [
                    `"${(r.name || "").replace(/"/g, '""')}"`,
                    `"${(r.description || "").replace(/"/g, '""')}"`,
                    r.status,
                    r.sortOrder,
                    `"${(r.collectionName || "").replace(/"/g, '""')}"`,
                    `"${(r.tags || []).join(", ")}"`,
                    r.createdAt?.toISOString() || ""
                ].join(",")
            ).join("\n");

            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", "attachment; filename=items.csv");
            return res.send(header + csv);
        }

        res.json(rows);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// GET /api/export/collections?format=json|csv
router.get("/collections", async (req, res) => {
    try {
        const rows = await Entity.find({ type: "collection" }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        const format = req.query.format || "json";

        await ActivityLog.create({
            adminId: req.admin.id,
            action: "export",
            entityType: "collection",
            details: { format, count: rows.length }
        });

        if (format === "csv") {
            const header = "Name,Description,Status,SortOrder,Tags,CreatedAt\n";
            const csv = rows.map(r =>
                [
                    `"${(r.name || "").replace(/"/g, '""')}"`,
                    `"${(r.description || "").replace(/"/g, '""')}"`,
                    r.status,
                    r.sortOrder,
                    `"${(r.tags || []).join(", ")}"`,
                    r.createdAt?.toISOString() || ""
                ].join(",")
            ).join("\n");

            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", "attachment; filename=collections.csv");
            return res.send(header + csv);
        }

        res.json(rows);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// GET /api/export/activity?format=json|csv
router.get("/activity", async (req, res) => {
    try {
        const rows = await ActivityLog.find().sort({ createdAt: -1 }).limit(500).lean();
        const format = req.query.format || "json";

        if (format === "csv") {
            const header = "Action,EntityType,EntityName,Details,CreatedAt\n";
            const csv = rows.map(r =>
                [
                    r.action,
                    r.entityType || "",
                    `"${(r.entityName || "").replace(/"/g, '""')}"`,
                    `"${JSON.stringify(r.details || {}).replace(/"/g, '""')}"`,
                    r.createdAt?.toISOString() || ""
                ].join(",")
            ).join("\n");

            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", "attachment; filename=activity_log.csv");
            return res.send(header + csv);
        }

        res.json(rows);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

module.exports = router;
