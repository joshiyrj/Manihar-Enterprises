const router = require("express").Router();
const { requireAdmin } = require("../middlewares/requireAdmin");
const Entity = require("../models/Entity");
const ActivityLog = require("../models/ActivityLog");
const AdminUser = require("../models/AdminUser");
const os = require("os");

router.use(requireAdmin);

// GET /api/analytics/dashboard — real-time dashboard stats
router.get("/dashboard", async (req, res) => {
    try {
        const [
            totalItems,
            totalCollections,
            activeItems,
            activeCollections,
            recentActivity,
            totalTags
        ] = await Promise.all([
            Entity.countDocuments({ type: "item" }),
            Entity.countDocuments({ type: "collection" }),
            Entity.countDocuments({ type: "item", status: "active" }),
            Entity.countDocuments({ type: "collection", status: "active" }),
            ActivityLog.find()
                .sort({ createdAt: -1 })
                .limit(15)
                .lean(),
            Entity.distinct("tags")
        ]);

        res.json({
            totalItems,
            totalCollections,
            activeItems,
            activeCollections,
            inactiveItems: totalItems - activeItems,
            inactiveCollections: totalCollections - activeCollections,
            totalTags: totalTags.length,
            recentActivity
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// GET /api/analytics/activity — paginated activity log
router.get("/activity", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.action) filter.action = req.query.action;
        if (req.query.entityType) filter.entityType = req.query.entityType;

        const [rows, total] = await Promise.all([
            ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            ActivityLog.countDocuments(filter)
        ]);

        res.json({ rows, total, page, pages: Math.ceil(total / limit) });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// GET /api/analytics/system — system info
router.get("/system", async (req, res) => {
    try {
        const admin = await AdminUser.findById(req.admin.id).lean();
        res.json({
            serverUptime: process.uptime(),
            nodeVersion: process.version,
            platform: os.platform(),
            hostname: os.hostname(),
            memoryUsage: process.memoryUsage(),
            adminUsername: admin?.username,
            adminName: admin?.name,
            serverTime: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

module.exports = router;
