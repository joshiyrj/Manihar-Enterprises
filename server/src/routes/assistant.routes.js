const router = require("express").Router();
const { requireAdmin } = require("../middlewares/requireAdmin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { z } = require("zod");
const Entity = require("../models/Entity");
const AdminUser = require("../models/AdminUser");
const ActivityLog = require("../models/ActivityLog");
const Mill = require("../models/Mill");
const Quantity = require("../models/Quantity");
const DesignNo = require("../models/DesignNo");

router.use(requireAdmin);

function getGenAI() {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "YOUR_GEMINI_API_KEY_HERE") {
        throw new Error("GEMINI_API_KEY_MISSING");
    }
    return new GoogleGenerativeAI(key);
}

const SYSTEM_PROMPT = `You are the S Management Admin Assistant.
Your job is to help the admin complete tasks inside this admin panel only.
Be professional, concise, and action focused.

SCOPE:
- Profile management (name, email, mobile)
- Item management (add, edit, delete, list)
- Collection management (add, edit, delete, list)
- Mill management (add, edit, delete)
- Quantity management (add, edit, delete)
- Design number management (add, edit, delete)
- Admin navigation (dashboard, items, collections, mills, quantities, designNos, profile, activity, export)

OUT OF SCOPE:
- Any non-admin request (news, weather, coding help, jokes, general knowledge, etc.)
- If out of scope, reply with action "none" and a short refusal.

OUTPUT FORMAT:
Return strict JSON only:
{
  "message": "Short response for the admin",
  "action": {
    "type": "edit_profile | add_item | edit_item | delete_item | add_collection | edit_collection | delete_collection | list_items | list_collections | navigate | add_mill | edit_mill | delete_mill | add_quantity | edit_quantity | delete_quantity | add_design_no | edit_design_no | delete_design_no | none",
    "params": {},
    "requiresConfirmation": true or false
  }
}

RULES:
- requiresConfirmation MUST be true for create, update, and delete actions.
- requiresConfirmation MUST be false for list, navigate, and none.
- If user intent is unclear, ask exactly one clarification question with action "none".
- Do not invent data that is not present in the prompt.
- Do not include markdown, code fences, or extra keys.
- Keep message <= 2 short sentences.`;

const ACTION_TYPES = [
    "edit_profile",
    "add_item",
    "edit_item",
    "delete_item",
    "add_collection",
    "edit_collection",
    "delete_collection",
    "list_items",
    "list_collections",
    "navigate",
    "add_mill",
    "edit_mill",
    "delete_mill",
    "add_quantity",
    "edit_quantity",
    "delete_quantity",
    "add_design_no",
    "edit_design_no",
    "delete_design_no",
    "none"
];

const ACTION_TYPE_SET = new Set(ACTION_TYPES);
const MUTATING_ACTIONS = new Set([
    "edit_profile",
    "add_item",
    "edit_item",
    "delete_item",
    "add_collection",
    "edit_collection",
    "delete_collection",
    "add_mill",
    "edit_mill",
    "delete_mill",
    "add_quantity",
    "edit_quantity",
    "delete_quantity",
    "add_design_no",
    "edit_design_no",
    "delete_design_no"
]);

const NONE_ACTION = { type: "none", params: {}, requiresConfirmation: false };
const NAV_PAGE_ALIASES = {
    dashboard: "dashboard",
    home: "dashboard",
    item: "items",
    items: "items",
    collection: "collections",
    collections: "collections",
    mill: "mills",
    mills: "mills",
    quantity: "quantities",
    quantities: "quantities",
    design: "designNos",
    designno: "designNos",
    designnos: "designNos",
    designnumber: "designNos",
    designnumbers: "designNos",
    profile: "profile",
    activity: "activity",
    activitylog: "activity",
    export: "export",
    exports: "export"
};

const assistantResponseSchema = z.object({
    message: z.string().optional(),
    action: z.object({
        type: z.string().optional(),
        params: z.record(z.any()).optional(),
        requiresConfirmation: z.boolean().optional()
    }).optional()
});

const UNRELATED_QUERY_REGEX = /\b(weather|temperature|news|sports|score|stock|crypto|bitcoin|joke|movie|recipe|poem|translate|song)\b/i;

// Prefer the higher-throughput text model first, then fall back to the stronger general model.
const MODELS = [
    process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
    process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash"
];
const LIVE_AUDIO_MODEL = process.env.GEMINI_LIVE_AUDIO_MODEL || "gemini-2.5-flash-native-audio-preview-12-2025";
const AUDIO_MODELS = [
    process.env.GEMINI_AUDIO_MODEL || "gemini-2.5-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite"
];

const SESSION_TTL_MS = 30 * 60 * 1000;
const assistantSessions = new Map();
const ENABLE_NATIVE_VOICE = String(process.env.ASSISTANT_NATIVE_VOICE_ENABLED || "true").toLowerCase() !== "false";
let nativeVoiceProbeCache = {
    checkedAt: 0,
    supported: false,
    model: LIVE_AUDIO_MODEL,
    error: ""
};

const REQUIRED_FIELDS_BY_ACTION = {
    add_item: ["name", "collectionName"],
    edit_item: ["name", "changes"],
    delete_item: ["name"],
    add_collection: ["name"],
    edit_collection: ["name", "changes"],
    delete_collection: ["name"],
    add_mill: ["name"],
    edit_mill: ["name", "changes"],
    delete_mill: ["name"],
    add_quantity: ["label", "value"],
    edit_quantity: ["label", "changes"],
    delete_quantity: ["label"],
    add_design_no: ["designNumber"],
    edit_design_no: ["designNumber", "changes"],
    delete_design_no: ["designNumber"],
    edit_profile: ["changes"]
};

const UPDATE_FIELDS_BY_ACTION = {
    edit_item: ["newName", "description", "status", "sortOrder", "tags", "collectionName"],
    edit_collection: ["newName", "description", "status", "sortOrder", "tags"],
    edit_mill: ["newName", "location", "contactPerson", "phone", "status", "notes"],
    edit_quantity: ["newLabel", "value", "unit", "category", "status", "notes"],
    edit_design_no: ["newDesignNumber", "title", "category", "color", "mill", "status", "notes"],
    edit_profile: ["name", "email", "mobile"]
};

const MODULE_ALIASES = {
    item: "items",
    items: "items",
    product: "items",
    products: "items",
    collection: "collections",
    collections: "collections",
    category: "categories",
    categories: "categories",
    mill: "mills",
    mills: "mills",
    quantity: "quantities",
    quantities: "quantities",
    design: "designNos",
    designno: "designNos",
    designnos: "designNos",
    profile: "profile",
    dashboard: "dashboard",
    activity: "activity",
    export: "export",
    user: "users",
    users: "users",
    order: "orders",
    orders: "orders"
};

const ACTION_ANALYZER_PROMPT = `You extract admin intent for S Management.
Return JSON only:
{
  "intent": "action|confirm|cancel|chat|unknown",
  "operation": "create|update|delete|list|navigate|none",
  "module": "items|collections|categories|mills|quantities|designNos|profile|activity|export|dashboard|users|orders|unknown",
  "actionType": "edit_profile|add_item|edit_item|delete_item|add_collection|edit_collection|delete_collection|list_items|list_collections|navigate|add_mill|edit_mill|delete_mill|add_quantity|edit_quantity|delete_quantity|add_design_no|edit_design_no|delete_design_no|none",
  "params": {},
  "reply": "short optional assistant sentence"
}
Rules:
- Extract only what user explicitly asked.
- If current draft exists and user is giving missing details, keep actionType aligned with that draft.
- For category/category management, module should be "categories".
- For users/orders requests, set module to "users" or "orders" and actionType to "none".
- For confirmations like yes/confirm, intent should be "confirm".
- For cancellations like no/cancel/stop, intent should be "cancel".`;

// Try Gemini API with model fallback (fail fast, no delayed retries).
async function callGeminiWithRetry(genAI, request) {
    let lastError;

    for (const modelName of MODELS) {
        try {
            console.log(`Trying model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            return await model.generateContent(request);
        } catch (err) {
            lastError = err;
            const is429 =
                err.status === 429 ||
                String(err.message || "").includes("429") ||
                String(err.message || "").includes("RESOURCE_EXHAUSTED");

            if (is429) {
                console.log(`${modelName}: rate limited (429), trying next model...`);
                continue;
            }

            if (err.status === 404) {
                console.log(`${modelName}: not available (404), trying next model...`);
                continue;
            }

            throw err;
        }
    }

    throw lastError;
}

function cleanText(value, maxLen = 240) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function cleanTags(tags) {
    if (!Array.isArray(tags)) return [];
    const seen = new Set();
    const cleaned = [];
    for (const tag of tags) {
        const t = cleanText(tag, 40);
        if (!t) continue;
        const key = t.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(t);
        if (cleaned.length >= 12) break;
    }
    return cleaned;
}

function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

function compactObject(obj) {
    const out = {};
    for (const [k, v] of Object.entries(asObject(obj))) {
        if (v === undefined || v === null || v === "") continue;
        out[k] = v;
    }
    return out;
}

function normalizeStatus(value) {
    return cleanText(value, 16).toLowerCase() === "inactive" ? "inactive" : "active";
}

function normalizePage(value) {
    const key = cleanText(value, 40).toLowerCase().replace(/[\s_-]+/g, "");
    return NAV_PAGE_ALIASES[key] || "";
}

function normalizeActionParams(type, rawParams) {
    const p = asObject(rawParams);
    switch (type) {
        case "edit_profile":
            return {
                name: cleanText(p.name, 100),
                email: cleanText(p.email, 160),
                mobile: cleanText(p.mobile, 40)
            };
        case "add_item":
            return {
                name: cleanText(p.name, 120),
                description: cleanText(p.description, 240),
                status: normalizeStatus(p.status),
                tags: cleanTags(p.tags),
                collectionName: cleanText(p.collectionName, 120),
                sortOrder: asNumber(p.sortOrder)
            };
        case "edit_item":
            return {
                name: cleanText(p.name, 120),
                newName: cleanText(p.newName, 120),
                description: cleanText(p.description, 240),
                status: p.status ? normalizeStatus(p.status) : "",
                tags: Array.isArray(p.tags) ? cleanTags(p.tags) : undefined,
                collectionName: cleanText(p.collectionName, 120),
                sortOrder: asNumber(p.sortOrder)
            };
        case "delete_item":
            return { name: cleanText(p.name, 120) };
        case "add_collection":
            return {
                name: cleanText(p.name, 120),
                description: cleanText(p.description, 240),
                status: normalizeStatus(p.status),
                tags: cleanTags(p.tags),
                sortOrder: asNumber(p.sortOrder)
            };
        case "edit_collection":
            return {
                name: cleanText(p.name, 120),
                newName: cleanText(p.newName, 120),
                description: cleanText(p.description, 240),
                status: p.status ? normalizeStatus(p.status) : "",
                sortOrder: asNumber(p.sortOrder),
                tags: Array.isArray(p.tags) ? cleanTags(p.tags) : undefined
            };
        case "delete_collection":
            return { name: cleanText(p.name, 120) };
        case "list_items":
            return {
                status: p.status ? normalizeStatus(p.status) : "",
                collectionName: cleanText(p.collectionName, 120)
            };
        case "list_collections":
            return {};
        case "navigate": {
            const page = normalizePage(p.page);
            return page ? { page } : {};
        }
        case "add_mill":
            return {
                name: cleanText(p.name, 120),
                location: cleanText(p.location, 120),
                contactPerson: cleanText(p.contactPerson, 120),
                phone: cleanText(p.phone, 40),
                status: normalizeStatus(p.status),
                notes: cleanText(p.notes, 300)
            };
        case "edit_mill":
            return {
                name: cleanText(p.name, 120),
                newName: cleanText(p.newName, 120),
                location: cleanText(p.location, 120),
                contactPerson: cleanText(p.contactPerson, 120),
                phone: cleanText(p.phone, 40),
                status: p.status ? normalizeStatus(p.status) : "",
                notes: cleanText(p.notes, 300)
            };
        case "delete_mill":
            return { name: cleanText(p.name, 120) };
        case "add_quantity":
            return {
                label: cleanText(p.label, 120),
                value: asNumber(p.value),
                unit: cleanText(p.unit, 40),
                category: cleanText(p.category, 80),
                status: normalizeStatus(p.status),
                notes: cleanText(p.notes, 300)
            };
        case "edit_quantity":
            return {
                label: cleanText(p.label, 120),
                newLabel: cleanText(p.newLabel, 120),
                value: p.value === undefined ? undefined : asNumber(p.value),
                unit: cleanText(p.unit, 40),
                category: cleanText(p.category, 80),
                status: p.status ? normalizeStatus(p.status) : "",
                notes: cleanText(p.notes, 300)
            };
        case "delete_quantity":
            return { label: cleanText(p.label, 120) };
        case "add_design_no":
            return {
                designNumber: cleanText(p.designNumber, 120),
                title: cleanText(p.title, 140),
                category: cleanText(p.category, 80),
                color: cleanText(p.color, 60),
                mill: cleanText(p.mill, 120),
                status: normalizeStatus(p.status),
                notes: cleanText(p.notes, 300)
            };
        case "edit_design_no":
            return {
                designNumber: cleanText(p.designNumber, 120),
                newDesignNumber: cleanText(p.newDesignNumber, 120),
                title: cleanText(p.title, 140),
                category: cleanText(p.category, 80),
                color: cleanText(p.color, 60),
                mill: cleanText(p.mill, 120),
                status: p.status ? normalizeStatus(p.status) : "",
                notes: cleanText(p.notes, 300)
            };
        case "delete_design_no":
            return { designNumber: cleanText(p.designNumber, 120) };
        default:
            return {};
    }
}

function normalizeAction(rawAction) {
    const action = asObject(rawAction);
    const type = cleanText(action.type, 40).toLowerCase().replace(/\s+/g, "_");

    if (!ACTION_TYPE_SET.has(type)) {
        return { ...NONE_ACTION };
    }

    const params = compactObject(normalizeActionParams(type, action.params));
    if (type === "navigate" && !params.page) {
        return { ...NONE_ACTION };
    }

    return {
        type,
        params,
        requiresConfirmation: MUTATING_ACTIONS.has(type)
    };
}

function parseAssistantJson(rawText) {
    const text = String(rawText || "").trim();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        const firstBrace = text.indexOf("{");
        const lastBrace = text.lastIndexOf("}");
        if (firstBrace === -1 || lastBrace <= firstBrace) return null;
        try {
            return JSON.parse(text.slice(firstBrace, lastBrace + 1));
        } catch {
            return null;
        }
    }
}

function defaultMessageForAction(action) {
    if (!action || action.type === "none") {
        return "I can help only with S Management admin tasks. Please give a specific admin command.";
    }

    if (action.type === "navigate") {
        const labelMap = {
            dashboard: "dashboard",
            items: "items",
            collections: "collections",
            mills: "mills",
            quantities: "quantities",
            designNos: "design numbers",
            profile: "profile",
            activity: "activity",
            export: "export"
        };
        const label = labelMap[action.params?.page] || "requested page";
        return `Opening ${label}.`;
    }

    if (action.type === "list_items") return "Opening items.";
    if (action.type === "list_collections") return "Opening collections.";
    return "Ready to apply this admin action. Please confirm to continue.";
}

function normalizeAssistantResponse(rawResponse) {
    const parsed = assistantResponseSchema.safeParse(rawResponse);
    const payload = parsed.success ? parsed.data : {};

    const action = normalizeAction(payload.action);
    let message = cleanText(payload.message, 320);

    if (!message) {
        message = defaultMessageForAction(action);
    }

    if (MUTATING_ACTIONS.has(action.type) && !/\bconfirm|proceed|approve|yes\b/i.test(message)) {
        message = `${message} Please confirm to continue.`;
    }

    return { message, action };
}

function formatItemsForPrompt(items, totalCount) {
    if (!items.length) return "none";
    const preview = items
        .slice(0, 50)
        .map((i) => `"${cleanText(i.name, 80)}"[${cleanText(i.status, 16)}]@${cleanText(i.collectionName || "Unassigned", 80)}`)
        .join(", ");
    const remainder = Math.max(totalCount - items.length, 0);
    return remainder > 0 ? `${preview} (+${remainder} more)` : preview;
}

function formatCollectionsForPrompt(collections, totalCount) {
    if (!collections.length) return "none";
    const preview = collections
        .slice(0, 50)
        .map((c) => `"${cleanText(c.name, 80)}"[${cleanText(c.status, 16)}]`)
        .join(", ");
    const remainder = Math.max(totalCount - collections.length, 0);
    return remainder > 0 ? `${preview} (+${remainder} more)` : preview;
}

function sanitizeHistory(history) {
    if (!Array.isArray(history)) return [];
    return history
        .slice(-12)
        .map((entry) => ({
            role: entry?.role === "assistant" ? "assistant" : "user",
            text: cleanText(entry?.text, 220)
        }))
        .filter((entry) => entry.text);
}

function fallbackAssistant(message, context = "", history = []) {
    const text = cleanText(message, 280);
    const lower = text.toLowerCase();
    const safeHistory = sanitizeHistory(history);
    const recentUserText = safeHistory
        .filter((m) => m.role === "user")
        .map((m) => m.text)
        .join(" | ")
        .toLowerCase();
    const combined = `${recentUserText} | ${lower}`;

    const nav = (page, label) => ({
        message: `Opening ${label}.`,
        action: { type: "navigate", params: { page }, requiresConfirmation: false }
    });

    if (!text) {
        return {
            message: "Please give one specific admin command, for example: add item Orange in collection Fruits.",
            action: { ...NONE_ACTION }
        };
    }

    if (/(^|\b)(hi|hello|hey)\b/.test(lower)) {
        return {
            message: "Hello. Tell me the admin task you want to complete.",
            action: { ...NONE_ACTION }
        };
    }

    if (/(what can you do|help|capabilities)/i.test(lower)) {
        return {
            message: "I can manage profile, items, collections, mills, quantities, design numbers, and navigation in this admin panel.",
            action: { ...NONE_ACTION }
        };
    }

    if (UNRELATED_QUERY_REGEX.test(lower)) {
        return {
            message: "I handle only S Management admin tasks. Please share a specific admin request.",
            action: { ...NONE_ACTION }
        };
    }

    const hasNavVerb = /\b(open|go to|navigate)\b/.test(combined);
    if (combined.includes("export")) return nav("export", "export page");
    if (combined.includes("activity")) return nav("activity", "activity page");
    if (combined.includes("dashboard")) return nav("dashboard", "dashboard");
    if (hasNavVerb && combined.includes("item")) return nav("items", "items page");
    if (hasNavVerb && combined.includes("collection")) return nav("collections", "collections page");
    if (hasNavVerb && combined.includes("mill")) return nav("mills", "mills page");
    if (hasNavVerb && combined.includes("quantit")) return nav("quantities", "quantities page");
    if (hasNavVerb && combined.includes("design")) return nav("designNos", "design numbers page");

    const itemNameMatch =
        text.match(/item\s+name\s+is\s+([a-z0-9][a-z0-9 _-]*?)(?:\s+(?:in|into)\s+collection|\s+collection|\s*$)/i) ||
        text.match(/add\s+(?:a\s+new\s+)?item(?:\s+named)?\s+([a-z0-9][a-z0-9 _-]*?)(?:\s+(?:in|into)\s+collection|\s+collection|\s*$)/i);
    const itemCollectionMatch = text.match(/collection\s+(?:named|name\s+is|is)\s+([a-z0-9][a-z0-9 _-]*)/i);

    if (combined.includes("add") && combined.includes("item")) {
        const itemName = cleanText(itemNameMatch?.[1], 120);
        const collectionName = cleanText(itemCollectionMatch?.[1], 120);
        if (!itemName) {
            return {
                message: "I need the item name. Example: add item Orange in collection Fruits.",
                action: { ...NONE_ACTION }
            };
        }
        return {
            message: `I am ready to create item "${itemName}"${collectionName ? ` in collection "${collectionName}"` : ""}. Please confirm.`,
            action: {
                type: "add_item",
                params: { name: itemName, collectionName, status: "active" },
                requiresConfirmation: true
            }
        };
    }

    const collectionNameMatch =
        text.match(/collection\s+name\s+is\s+([a-z0-9][a-z0-9 _-]*)/i) ||
        text.match(/add\s+collection\s+([a-z0-9][a-z0-9 _-]*)/i);
    if (combined.includes("add") && combined.includes("collection")) {
        const collectionName = cleanText(collectionNameMatch?.[1], 120);
        if (!collectionName) {
            return {
                message: "I need the collection name. Example: add collection Fruits.",
                action: { ...NONE_ACTION }
            };
        }
        return {
            message: `I am ready to create collection "${collectionName}". Please confirm.`,
            action: {
                type: "add_collection",
                params: { name: collectionName, status: "active" },
                requiresConfirmation: true
            }
        };
    }

    if (combined.includes("list") || combined.includes("show")) {
        if (combined.includes("item")) {
            return {
                message: "Opening items list.",
                action: { type: "list_items", params: {}, requiresConfirmation: false }
            };
        }
        if (combined.includes("collection")) {
            return {
                message: "Opening collections list.",
                action: { type: "list_collections", params: {}, requiresConfirmation: false }
            };
        }
    }

    return {
        message: `Please provide one clear admin command${context ? ` for ${cleanText(context, 60)}` : ""}, including the item or collection name when relevant.`,
        action: { ...NONE_ACTION }
    };
}
function getAssistantSession(adminId) {
    const now = Date.now();
    for (const [id, session] of assistantSessions.entries()) {
        if (now - (session?.updatedAt || 0) > SESSION_TTL_MS) assistantSessions.delete(id);
    }

    const key = String(adminId || "");
    let session = assistantSessions.get(key);
    if (!session) {
        session = {
            draft: null,
            execution: { inFlight: false, lastFingerprint: "", lastAt: 0 },
            updatedAt: now
        };
        assistantSessions.set(key, session);
    }
    session.updatedAt = now;
    return session;
}

function clearAssistantDraft(adminId) {
    const session = getAssistantSession(adminId);
    session.draft = null;
    session.updatedAt = Date.now();
}

function moduleFromActionType(actionType) {
    const map = {
        add_item: "items",
        edit_item: "items",
        delete_item: "items",
        list_items: "items",
        add_collection: "collections",
        edit_collection: "collections",
        delete_collection: "collections",
        list_collections: "collections",
        add_mill: "mills",
        edit_mill: "mills",
        delete_mill: "mills",
        add_quantity: "quantities",
        edit_quantity: "quantities",
        delete_quantity: "quantities",
        add_design_no: "designNos",
        edit_design_no: "designNos",
        delete_design_no: "designNos",
        edit_profile: "profile",
        navigate: "dashboard"
    };
    return map[actionType] || "unknown";
}

function normalizeModule(moduleName) {
    const key = cleanText(moduleName, 40).toLowerCase().replace(/[\s_-]+/g, "");
    return MODULE_ALIASES[key] || "unknown";
}

function normalizeOperation(value) {
    const op = cleanText(value, 20).toLowerCase();
    if (["create", "add", "new"].includes(op)) return "create";
    if (["update", "edit", "change", "modify"].includes(op)) return "update";
    if (["delete", "remove"].includes(op)) return "delete";
    if (["list", "show", "view"].includes(op)) return "list";
    if (["navigate", "open", "goto", "go"].includes(op)) return "navigate";
    return "none";
}

function inferActionType(operation, moduleName) {
    const module = moduleName === "categories" ? "collections" : moduleName;
    if (module === "users" || module === "orders") return "none";
    if (operation === "navigate") return "navigate";

    if (operation === "list") {
        if (module === "items") return "list_items";
        if (module === "collections") return "list_collections";
        return "none";
    }

    const createMap = {
        items: "add_item",
        collections: "add_collection",
        mills: "add_mill",
        quantities: "add_quantity",
        designNos: "add_design_no"
    };
    const editMap = {
        items: "edit_item",
        collections: "edit_collection",
        mills: "edit_mill",
        quantities: "edit_quantity",
        designNos: "edit_design_no",
        profile: "edit_profile"
    };
    const deleteMap = {
        items: "delete_item",
        collections: "delete_collection",
        mills: "delete_mill",
        quantities: "delete_quantity",
        designNos: "delete_design_no"
    };

    if (operation === "create") return createMap[module] || "none";
    if (operation === "update") return editMap[module] || "none";
    if (operation === "delete") return deleteMap[module] || "none";
    return "none";
}

function detectModuleFromText(text) {
    const lower = cleanText(text, 280).toLowerCase();
    if (/\bitem|items|product|products\b/.test(lower)) return "items";
    if (/\bcollection|collections|category|categories\b/.test(lower)) return lower.includes("category") ? "categories" : "collections";
    if (/\bmill|mills\b/.test(lower)) return "mills";
    if (/\bquantity|quantities\b/.test(lower)) return "quantities";
    if (/\bdesign\b/.test(lower)) return "designNos";
    if (/\bprofile|email|mobile|phone number\b/.test(lower)) return "profile";
    if (/\bactivity\b/.test(lower)) return "activity";
    if (/\bexport\b/.test(lower)) return "export";
    if (/\bdashboard\b/.test(lower)) return "dashboard";
    if (/\buser|users\b/.test(lower)) return "users";
    if (/\border|orders\b/.test(lower)) return "orders";
    return "unknown";
}

function detectOperationFromText(text) {
    const lower = cleanText(text, 280).toLowerCase();
    if (/\b(create|add|new)\b/.test(lower)) return "create";
    if (/\b(update|edit|change|modify|rename|move)\b/.test(lower)) return "update";
    if (/\b(delete|remove)\b/.test(lower)) return "delete";
    if (/\b(list|show|view)\b/.test(lower)) return "list";
    if (/\b(open|go to|navigate)\b/.test(lower)) return "navigate";
    return "none";
}

function isConfirmMessage(text) {
    return /\b(yes|yep|yeah|confirm|confirmed|go ahead|proceed|do it|ok|okay|sure)\b/i.test(text);
}

function isCancelMessage(text) {
    return /\b(no|cancel|stop|abort|forget it|nevermind|never mind|do not)\b/i.test(text);
}

function looksLikeNewCommand(text) {
    return /\b(create|add|new|update|edit|change|delete|remove|list|show|open|go to|navigate)\b/i.test(text);
}

function normalizeFreeTextField(field, text) {
    let value = cleanText(text, 220);
    value = value
        .replace(/^(it is|it's|is|name is|called|set (?:it )?to|make it)\s+/i, "")
        .replace(/^please\s+/i, "")
        .trim();

    if (field === "collectionName") value = value.replace(/\bcollection\b/i, "").trim();
    if (field === "value") return asNumber(value.replace(/,/g, ""));
    if (field === "status") return ["active", "inactive"].includes(value.toLowerCase()) ? value.toLowerCase() : "";
    return value;
}

function hasUpdateFields(actionType, params) {
    const keys = UPDATE_FIELDS_BY_ACTION[actionType] || [];
    return keys.some((key) => params[key] !== undefined && params[key] !== null && params[key] !== "");
}

function getNextMissingField(actionType, params) {
    const required = REQUIRED_FIELDS_BY_ACTION[actionType] || [];
    for (const field of required) {
        if (field === "changes") {
            if (!hasUpdateFields(actionType, params)) return "changes";
            continue;
        }
        if (params[field] === undefined || params[field] === null || params[field] === "") return field;
    }
    return "";
}

function getFollowupQuestion(actionType, field) {
    const moduleLabel = {
        add_item: "item",
        edit_item: "item",
        delete_item: "item",
        add_collection: "collection",
        edit_collection: "collection",
        delete_collection: "collection",
        add_mill: "mill",
        edit_mill: "mill",
        delete_mill: "mill",
        add_quantity: "quantity",
        edit_quantity: "quantity",
        delete_quantity: "quantity",
        add_design_no: "design number",
        edit_design_no: "design number",
        delete_design_no: "design number",
        edit_profile: "profile"
    };

    if (field === "name") return `What is the ${moduleLabel[actionType] || "record"} name?`;
    if (field === "collectionName") return "Which collection should this item belong to?";
    if (field === "label") return "What is the quantity label?";
    if (field === "value") return "What numeric value should I use for the quantity?";
    if (field === "designNumber") return "What is the design number?";
    if (field === "changes") return "What exact fields should I update?";
    return "Please provide the missing value.";
}

function getClarificationMessage(moduleName, operation) {
    const moduleLabelMap = {
        items: "item",
        collections: "collection",
        categories: "category",
        mills: "mill",
        quantities: "quantity",
        designNos: "design number",
        profile: "profile"
    };

    const operationLabelMap = {
        create: "create",
        update: "update",
        delete: "delete",
        list: "list",
        navigate: "open"
    };

    const moduleLabel = moduleLabelMap[moduleName];
    const operationLabel = operationLabelMap[operation];
    if (!moduleLabel || !operationLabel) return "";

    return `I understood that you want to ${operationLabel} a ${moduleLabel}. Please provide the missing details.`;
}

function summarizeAction(action) {
    const p = action?.params || {};
    switch (action?.type) {
        case "add_item":
            return `I will create item "${p.name}" in collection "${p.collectionName}".`;
        case "edit_item":
            return `I will update item "${p.name}" with the requested changes.`;
        case "delete_item":
            return `I will delete item "${p.name}".`;
        case "add_collection":
            return `I will create collection "${p.name}".`;
        case "edit_collection":
            return `I will update collection "${p.name}" with the requested changes.`;
        case "delete_collection":
            return `I will delete collection "${p.name}".`;
        case "add_mill":
            return `I will create mill "${p.name}".`;
        case "edit_mill":
            return `I will update mill "${p.name}" with the requested changes.`;
        case "delete_mill":
            return `I will delete mill "${p.name}".`;
        case "add_quantity":
            return `I will create quantity "${p.label}" with value ${p.value}.`;
        case "edit_quantity":
            return `I will update quantity "${p.label}" with the requested changes.`;
        case "delete_quantity":
            return `I will delete quantity "${p.label}".`;
        case "add_design_no":
            return `I will create design number "${p.designNumber}".`;
        case "edit_design_no":
            return `I will update design number "${p.designNumber}" with the requested changes.`;
        case "delete_design_no":
            return `I will delete design number "${p.designNumber}".`;
        case "edit_profile":
            return "I will update your profile with the requested changes.";
        default:
            return defaultMessageForAction(action);
    }
}

function mergeDraftParams(draft, params) {
    const next = { ...(draft?.params || {}) };
    for (const [key, value] of Object.entries(asObject(params))) {
        if (value === undefined || value === null || value === "") continue;
        next[key] = value;
    }
    return next;
}

function createDraft(actionType, params = {}) {
    return {
        actionType,
        module: moduleFromActionType(actionType),
        params: compactObject(params),
        awaitingField: "",
        readyForConfirmation: false,
        updatedAt: Date.now()
    };
}

function normalizeAnalyzerPayload(parsed, draftActionType = "") {
    const payload = asObject(parsed);
    const intentRaw = cleanText(payload.intent, 20).toLowerCase();
    const intent = ["action", "confirm", "cancel", "chat", "unknown"].includes(intentRaw) ? intentRaw : "unknown";
    const module = normalizeModule(payload.module);
    const operation = normalizeOperation(payload.operation);

    let actionType = cleanText(payload.actionType, 40).toLowerCase().replace(/\s+/g, "_");
    if (!ACTION_TYPE_SET.has(actionType)) actionType = inferActionType(operation, module);
    if ((!actionType || actionType === "none") && draftActionType) actionType = draftActionType;

    const action = normalizeAction({ type: actionType, params: payload.params });
    return {
        intent,
        operation,
        module,
        action,
        reply: cleanText(payload.reply, 220)
    };
}

function ruleBasedAnalyze(message, draft = null) {
    const text = cleanText(message, 280);
    const lower = text.toLowerCase();
    const detectedModule = detectModuleFromText(text);
    const detectedOperation = detectOperationFromText(text);

    if (isConfirmMessage(text)) return { intent: "confirm", operation: "none", module: draft?.module || "unknown", action: { ...NONE_ACTION }, reply: "" };
    if (isCancelMessage(text)) return { intent: "cancel", operation: "none", module: draft?.module || "unknown", action: { ...NONE_ACTION }, reply: "" };

    if (/\b(hello|hi|hey|thanks|thank you)\b/i.test(lower)) {
        return { intent: "chat", operation: "none", module: "unknown", action: { ...NONE_ACTION }, reply: "Hello. Please tell me the admin task you want to complete." };
    }

    if (lower.includes("order")) return { intent: "action", operation: "none", module: "orders", action: { ...NONE_ACTION }, reply: "" };
    if (lower.includes("user")) return { intent: "action", operation: "none", module: "users", action: { ...NONE_ACTION }, reply: "" };

    const hasAdd = /\b(create|add|new)\b/i.test(lower);
    const hasEdit = /\b(update|edit|change|modify|rename|move)\b/i.test(lower);
    const hasDelete = /\b(delete|remove)\b/i.test(lower);

    if (hasAdd && lower.includes("item")) {
        const nameMatch = text.match(/item(?:\s+named|\s+name\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        const collectionMatch = text.match(/(?:in|into)\s+([a-z0-9][a-z0-9 _-]*)\s+collection/i);
        return {
            intent: "action",
            operation: "create",
            module: "items",
            action: normalizeAction({
                type: "add_item",
                params: { name: cleanText(nameMatch?.[1], 120), collectionName: cleanText(collectionMatch?.[1], 120), status: "active" }
            }),
            reply: ""
        };
    }

    if (hasAdd && (lower.includes("collection") || lower.includes("category"))) {
        const nameMatch = text.match(/(?:collection|category)(?:\s+named|\s+name\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "create",
            module: lower.includes("category") ? "categories" : "collections",
            action: normalizeAction({ type: "add_collection", params: { name: cleanText(nameMatch?.[1], 120), status: "active" } }),
            reply: ""
        };
    }

    if (hasDelete && lower.includes("item")) {
        const nameMatch = text.match(/item(?:\s+named|\s+name\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "delete",
            module: "items",
            action: normalizeAction({ type: "delete_item", params: { name: cleanText(nameMatch?.[1], 120) } }),
            reply: ""
        };
    }

    if (hasDelete && (lower.includes("collection") || lower.includes("category"))) {
        const nameMatch = text.match(/(?:collection|category)(?:\s+named|\s+name\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "delete",
            module: lower.includes("category") ? "categories" : "collections",
            action: normalizeAction({ type: "delete_collection", params: { name: cleanText(nameMatch?.[1], 120) } }),
            reply: ""
        };
    }

    if (hasEdit && lower.includes("item")) {
        const nameMatch = text.match(/item(?:\s+named|\s+name\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "update",
            module: "items",
            action: normalizeAction({ type: "edit_item", params: { name: cleanText(nameMatch?.[1], 120) } }),
            reply: ""
        };
    }

    if (hasEdit && (lower.includes("collection") || lower.includes("category"))) {
        const nameMatch = text.match(/(?:collection|category)(?:\s+named|\s+name\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "update",
            module: lower.includes("category") ? "categories" : "collections",
            action: normalizeAction({ type: "edit_collection", params: { name: cleanText(nameMatch?.[1], 120) } }),
            reply: ""
        };
    }

    if (detectedModule === "mills" && detectedOperation === "create") {
        const nameMatch = text.match(/mill(?:\s+named|\s+name\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "create",
            module: "mills",
            action: normalizeAction({ type: "add_mill", params: { name: cleanText(nameMatch?.[1], 120), status: "active" } }),
            reply: ""
        };
    }

    if (detectedModule === "mills" && detectedOperation === "update") {
        const nameMatch = text.match(/mill(?:\s+named|\s+name\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "update",
            module: "mills",
            action: normalizeAction({ type: "edit_mill", params: { name: cleanText(nameMatch?.[1], 120) } }),
            reply: ""
        };
    }

    if (detectedModule === "mills" && detectedOperation === "delete") {
        const nameMatch = text.match(/mill(?:\s+named|\s+name\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "delete",
            module: "mills",
            action: normalizeAction({ type: "delete_mill", params: { name: cleanText(nameMatch?.[1], 120) } }),
            reply: ""
        };
    }

    if (detectedModule === "quantities" && detectedOperation === "create") {
        const labelMatch = text.match(/(?:quantity|quantities)(?:\s+named|\s+label\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        const valueMatch = text.match(/\bvalue\s+(?:is\s+)?([0-9]+(?:\.[0-9]+)?)/i) || text.match(/\b([0-9]+(?:\.[0-9]+)?)\b/);
        return {
            intent: "action",
            operation: "create",
            module: "quantities",
            action: normalizeAction({ type: "add_quantity", params: { label: cleanText(labelMatch?.[1], 120), value: valueMatch?.[1] } }),
            reply: ""
        };
    }

    if (detectedModule === "quantities" && detectedOperation === "update") {
        const labelMatch = text.match(/(?:quantity|quantities)(?:\s+named|\s+label\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "update",
            module: "quantities",
            action: normalizeAction({ type: "edit_quantity", params: { label: cleanText(labelMatch?.[1], 120) } }),
            reply: ""
        };
    }

    if (detectedModule === "quantities" && detectedOperation === "delete") {
        const labelMatch = text.match(/(?:quantity|quantities)(?:\s+named|\s+label\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "delete",
            module: "quantities",
            action: normalizeAction({ type: "delete_quantity", params: { label: cleanText(labelMatch?.[1], 120) } }),
            reply: ""
        };
    }

    if (detectedModule === "designNos" && detectedOperation === "create") {
        const designMatch = text.match(/design(?:\s+number)?(?:\s+named|\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "create",
            module: "designNos",
            action: normalizeAction({ type: "add_design_no", params: { designNumber: cleanText(designMatch?.[1], 120), status: "active" } }),
            reply: ""
        };
    }

    if (detectedModule === "designNos" && detectedOperation === "update") {
        const designMatch = text.match(/design(?:\s+number)?(?:\s+named|\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "update",
            module: "designNos",
            action: normalizeAction({ type: "edit_design_no", params: { designNumber: cleanText(designMatch?.[1], 120) } }),
            reply: ""
        };
    }

    if (detectedModule === "designNos" && detectedOperation === "delete") {
        const designMatch = text.match(/design(?:\s+number)?(?:\s+named|\s+is)?\s+([a-z0-9][a-z0-9 _-]*)/i);
        return {
            intent: "action",
            operation: "delete",
            module: "designNos",
            action: normalizeAction({ type: "delete_design_no", params: { designNumber: cleanText(designMatch?.[1], 120) } }),
            reply: ""
        };
    }

    if (detectedModule === "profile" && detectedOperation === "update") {
        return {
            intent: "action",
            operation: "update",
            module: "profile",
            action: normalizeAction({ type: "edit_profile", params: {} }),
            reply: ""
        };
    }

    if (/\b(list|show)\b/i.test(lower) && lower.includes("item")) {
        return { intent: "action", operation: "list", module: "items", action: normalizeAction({ type: "list_items", params: {} }), reply: "" };
    }
    if (/\b(list|show)\b/i.test(lower) && (lower.includes("collection") || lower.includes("category"))) {
        return { intent: "action", operation: "list", module: lower.includes("category") ? "categories" : "collections", action: normalizeAction({ type: "list_collections", params: {} }), reply: "" };
    }
    if (/\b(open|go to|navigate)\b/i.test(lower)) {
        const page = normalizePage(lower);
        return {
            intent: "action",
            operation: "navigate",
            module: page || "dashboard",
            action: normalizeAction({ type: "navigate", params: { page: page || "dashboard" } }),
            reply: ""
        };
    }

    if (detectedModule !== "unknown" && detectedOperation !== "none") {
        return {
            intent: "action",
            operation: detectedOperation,
            module: detectedModule,
            action: normalizeAction({ type: inferActionType(detectedOperation, detectedModule), params: {} }),
            reply: ""
        };
    }

    return { intent: "unknown", operation: "none", module: detectedModule, action: { ...NONE_ACTION }, reply: "" };
}

async function analyzeWithGemini(genAI, { message, context, history, draft }) {
    const historyText = history
        .slice(-8)
        .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.text}`)
        .join("\n");

    const draftText = draft
        ? `CURRENT DRAFT ACTION: ${draft.actionType}\nCURRENT DRAFT PARAMS: ${JSON.stringify(draft.params)}`
        : "CURRENT DRAFT ACTION: none";

    const prompt = `CONTEXT PAGE: ${context || "unknown"}\n${draftText}\n${historyText ? `RECENT HISTORY:\n${historyText}\n` : ""}USER MESSAGE: "${message}"`;

    const result = await callGeminiWithRetry(genAI, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: ACTION_ANALYZER_PROMPT }] },
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 320,
            responseMimeType: "application/json"
        }
    });

    const parsed = parseAssistantJson(result?.response?.text?.() || "") || {};
    return normalizeAnalyzerPayload(parsed, draft?.actionType || "");
}

async function analyzeUserMessage(genAI, payload) {
    const ruleResult = ruleBasedAnalyze(payload.message, payload.draft);

    const shouldAcceptRule =
        ruleResult.intent === "confirm" ||
        ruleResult.intent === "cancel" ||
        ruleResult.intent === "chat" ||
        ruleResult.action.type !== "none" ||
        ruleResult.module === "users" ||
        ruleResult.module === "orders";

    if (shouldAcceptRule) return ruleResult;

    try {
        const geminiResult = await analyzeWithGemini(genAI, payload);
        if (geminiResult.action.type !== "none" || geminiResult.intent === "confirm" || geminiResult.intent === "cancel") {
            return geminiResult;
        }
        return ruleResult;
    } catch {
        return ruleResult;
    }
}

async function applyMissingFieldAnswer(genAI, draft, userMessage, context, history) {
    const field = draft.awaitingField;
    if (!field) return draft;

    if (field === "changes") {
        const extracted = await analyzeUserMessage(genAI, {
            message: userMessage,
            context,
            history,
            draft
        });
        draft.params = mergeDraftParams(draft, extracted.action?.params || {});
    } else {
        const parsedValue = normalizeFreeTextField(field, userMessage);
        if (field === "value" && parsedValue === undefined) return draft;
        if (parsedValue !== undefined && parsedValue !== "") draft.params[field] = parsedValue;
    }

    draft.awaitingField = "";
    draft.updatedAt = Date.now();
    return draft;
}

async function callGeminiAudioWithModels(genAI, text, models) {
    let lastError;
    const seen = new Set();
    const modelList = models.filter((m) => {
        if (!m || seen.has(m)) return false;
        seen.add(m);
        return true;
    });

    for (const modelName of modelList) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: process.env.GEMINI_VOICE || "Aoede"
                            }
                        }
                    }
                }
            });

            const parts = result?.response?.candidates?.[0]?.content?.parts || [];
            const audioPart = parts.find((p) => p.inlineData?.data);
            if (audioPart?.inlineData?.data) {
                return {
                    audioBase64: audioPart.inlineData.data,
                    mimeType: audioPart.inlineData.mimeType || "audio/wav",
                    modelName
                };
            }
            throw new Error("AUDIO_RESPONSE_EMPTY");
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error("AUDIO_GENERATION_FAILED");
}

async function probeNativeVoiceSupport(genAI, force = false) {
    const now = Date.now();
    if (!force && nativeVoiceProbeCache.checkedAt && now - nativeVoiceProbeCache.checkedAt < 10 * 60 * 1000) {
        return nativeVoiceProbeCache;
    }

    if (!ENABLE_NATIVE_VOICE) {
        nativeVoiceProbeCache = {
            checkedAt: now,
            supported: false,
            model: LIVE_AUDIO_MODEL,
            error: "Native voice feature disabled by server configuration"
        };
        return nativeVoiceProbeCache;
    }

    try {
        await callGeminiAudioWithModels(genAI, "Voice capability check", [LIVE_AUDIO_MODEL]);
        nativeVoiceProbeCache = {
            checkedAt: now,
            supported: true,
            model: LIVE_AUDIO_MODEL,
            error: ""
        };
    } catch (e) {
        nativeVoiceProbeCache = {
            checkedAt: now,
            supported: false,
            model: LIVE_AUDIO_MODEL,
            error: String(e?.message || e || "Native voice probe failed")
        };
    }

    return nativeVoiceProbeCache;
}

router.get("/capabilities", async (req, res) => {
    try {
        const genAI = getGenAI();
        const native = await probeNativeVoiceSupport(genAI);
        return res.json({
            ok: true,
            nativeVoiceEnabled: ENABLE_NATIVE_VOICE,
            nativeVoiceSupported: native.supported,
            nativeVoiceModel: native.model,
            nativeVoiceError: native.error || "",
            textModel: MODELS[0],
            textFallbackModel: MODELS[1] || ""
        });
    } catch (e) {
        if (String(e?.message || "").includes("GEMINI_API_KEY_MISSING")) {
            return res.status(503).json({
                ok: false,
                nativeVoiceEnabled: ENABLE_NATIVE_VOICE,
                nativeVoiceSupported: false,
                nativeVoiceModel: LIVE_AUDIO_MODEL,
                nativeVoiceError: "Gemini API key is not configured"
            });
        }
        return res.status(502).json({
            ok: false,
            nativeVoiceEnabled: ENABLE_NATIVE_VOICE,
            nativeVoiceSupported: false,
            nativeVoiceModel: LIVE_AUDIO_MODEL,
            nativeVoiceError: "Could not verify native voice support"
        });
    }
});

// POST /api/assistant/chat
router.post("/chat", async (req, res) => {
    const userMessage = cleanText(req.body?.message, 1000);
    const context = cleanText(req.body?.context, 120);
    const history = sanitizeHistory(req.body?.history);

    try {
        if (!userMessage) return res.status(400).json({ message: "Message is required", action: { ...NONE_ACTION } });

        const session = getAssistantSession(req.admin.id);
        const draft = session.draft;

        if (isCancelMessage(userMessage)) {
            session.draft = null;
            return res.json({
                message: "Cancelled. I am ready for your next admin task.",
                action: { ...NONE_ACTION }
            });
        }

        const genAI = getGenAI();

        if (draft?.awaitingField && !looksLikeNewCommand(userMessage)) {
            const updatedDraft = await applyMissingFieldAnswer(genAI, { ...draft }, userMessage, context, history);
            const missingField = getNextMissingField(updatedDraft.actionType, updatedDraft.params);

            if (missingField) {
                updatedDraft.awaitingField = missingField;
                updatedDraft.readyForConfirmation = false;
                session.draft = updatedDraft;

                const needsNumericRetry = missingField === "value" && updatedDraft.params.value === undefined;
                return res.json({
                    message: needsNumericRetry
                        ? "I need a numeric value. Please provide a number like 10 or 25.5."
                        : getFollowupQuestion(updatedDraft.actionType, missingField),
                    action: { ...NONE_ACTION }
                });
            }

            const confirmAction = normalizeAction({ type: updatedDraft.actionType, params: updatedDraft.params });
            updatedDraft.awaitingField = "";
            updatedDraft.readyForConfirmation = true;
            session.draft = updatedDraft;

            const msg = `${summarizeAction(confirmAction)} Please confirm to proceed.`;
            await ActivityLog.create({
                adminId: req.admin.id,
                action: "assistant",
                details: { userMessage, assistantResponse: msg, actionType: confirmAction.type }
            });
            return res.json({ message: msg, action: { ...confirmAction, requiresConfirmation: true } });
        }

        const analysis = await analyzeUserMessage(genAI, { message: userMessage, context, history, draft });

        if (analysis.intent === "confirm") {
            if (draft?.readyForConfirmation) {
                const action = normalizeAction({ type: draft.actionType, params: draft.params });
                return res.json({
                    message: `${summarizeAction(action)} Please confirm to proceed.`,
                    action: { ...action, requiresConfirmation: true }
                });
            }
            return res.json({
                message: "There is no pending action to confirm. Please give a command first.",
                action: { ...NONE_ACTION }
            });
        }

        if (analysis.intent === "cancel") {
            session.draft = null;
            return res.json({
                message: "Cancelled. I am ready for your next admin task.",
                action: { ...NONE_ACTION }
            });
        }

        if (analysis.module === "users" || analysis.module === "orders") {
            session.draft = null;
            return res.json({
                message: `${analysis.module === "users" ? "User" : "Order"} management is not available in the current admin assistant API yet. Please use items, collections/categories, mills, quantities, design numbers, or profile.`,
                action: { ...NONE_ACTION }
            });
        }

        let action = analysis.action;
        if (analysis.module === "categories" && action.type === "none") {
            const mappedType = inferActionType(analysis.operation, "categories");
            if (mappedType !== "none") {
                action = normalizeAction({ type: mappedType, params: analysis.action.params });
            }
        }

        if (action.type === "none") {
            const clarification = getClarificationMessage(analysis.module, analysis.operation);
            if (clarification) {
                return res.json({
                    message: clarification,
                    action: { ...NONE_ACTION }
                });
            }
            const fallback = analysis.reply
                ? { message: analysis.reply, action: { ...NONE_ACTION } }
                : fallbackAssistant(userMessage, context, history);
            return res.json(normalizeAssistantResponse(fallback));
        }

        if (!MUTATING_ACTIONS.has(action.type)) {
            session.draft = null;
            return res.json({
                message: analysis.reply || defaultMessageForAction(action),
                action: { ...action, requiresConfirmation: false }
            });
        }

        const nextDraft = createDraft(action.type, action.params);
        const missingField = getNextMissingField(nextDraft.actionType, nextDraft.params);
        if (missingField) {
            nextDraft.awaitingField = missingField;
            nextDraft.readyForConfirmation = false;
            session.draft = nextDraft;
            return res.json({
                message: getFollowupQuestion(nextDraft.actionType, missingField),
                action: { ...NONE_ACTION }
            });
        }

        nextDraft.awaitingField = "";
        nextDraft.readyForConfirmation = true;
        session.draft = nextDraft;

        const confirmAction = normalizeAction({ type: nextDraft.actionType, params: nextDraft.params });
        const responseMessage = `${summarizeAction(confirmAction)} Please confirm to proceed.`;

        await ActivityLog.create({
            adminId: req.admin.id,
            action: "assistant",
            details: { userMessage, assistantResponse: responseMessage, actionType: confirmAction.type }
        });

        return res.json({ message: responseMessage, action: { ...confirmAction, requiresConfirmation: true } });
    } catch (e) {
        console.error("Assistant error:", e.message || e);
        const errStr = String(e.message || e).toLowerCase();

        let msg;
        let statusCode;
        if (e.message === "GEMINI_API_KEY_MISSING") {
            msg = "Gemini API key is not set. Please add your GEMINI_API_KEY to server/.env and restart.";
            statusCode = 503;
        } else if (e.status === 429 || errStr.includes("429") || errStr.includes("resource_exhausted") || errStr.includes("resource has been exhausted") || errStr.includes("quota")) {
            return res.json(fallbackAssistant(userMessage, context, history));
        } else if (e.status === 403 || errStr.includes("api key") || errStr.includes("permission") || errStr.includes("unauthorized")) {
            msg = "Gemini API key is invalid or missing required permissions in Google AI Studio.";
            statusCode = 403;
        } else {
            msg = "I could not process that request right now. Please try again.";
            statusCode = 500;
        }

        return res.status(statusCode).json({
            message: msg,
            action: { ...NONE_ACTION }
        });
    }
});

// POST /api/assistant/audio
router.post("/audio", async (req, res) => {
    try {
        const text = cleanText(req.body?.text, 600);
        const nativeVoiceRequested = Boolean(req.body?.nativeVoice);
        if (!text) return res.status(400).json({ message: "Text is required" });

        const genAI = getGenAI();
        let modelChain = AUDIO_MODELS;
        let nativeVoiceUsed = false;

        if (nativeVoiceRequested && ENABLE_NATIVE_VOICE) {
            const support = await probeNativeVoiceSupport(genAI);
            if (support.supported) {
                modelChain = [LIVE_AUDIO_MODEL, ...AUDIO_MODELS];
                nativeVoiceUsed = true;
            }
        }

        const result = await callGeminiAudioWithModels(genAI, text, modelChain);
        return res.json({
            ok: true,
            audioBase64: result.audioBase64,
            mimeType: result.mimeType,
            model: result.modelName,
            nativeVoiceUsed: nativeVoiceUsed && result.modelName === LIVE_AUDIO_MODEL,
            liveApiModelRequested: nativeVoiceRequested
        });
    } catch (e) {
        const errStr = String(e?.message || e).toLowerCase();
        if (errStr.includes("gemini_api_key_missing")) {
            return res.status(503).json({ message: "Gemini API key is not configured." });
        }
        return res.status(502).json({ message: "Gemini audio is unavailable right now." });
    }
});

// POST /api/assistant/execute — execute confirmed action
router.post("/execute", async (req, res) => {
    try {
        const action = normalizeAction(req.body?.action);
        if (!action || action.type === "none") {
            return res.status(400).json({ message: "No executable action specified" });
        }

        const session = getAssistantSession(req.admin.id);
        const actionFingerprint = JSON.stringify(action);
        const now = Date.now();
        if (session.execution?.inFlight) {
            return res.status(409).json({ message: "Another assistant action is already running. Please wait a moment." });
        }
        if (session.execution?.lastFingerprint === actionFingerprint && now - (session.execution?.lastAt || 0) < 4000) {
            return res.status(409).json({ message: "Duplicate action blocked. Please wait and try again only if needed." });
        }
        session.execution = { ...session.execution, inFlight: true };

        let result = {};
        let executedSuccessfully = false;

        try {
            switch (action.type) {
            case "edit_profile": {
                const p = action.params || {};
                const update = {};
                if (p.name) update.name = p.name;
                if (p.email) update.email = p.email;
                if (p.mobile) update.mobile = p.mobile;
                if (!Object.keys(update).length) {
                    return res.status(400).json({ message: "No profile fields to update" });
                }
                await AdminUser.findByIdAndUpdate(req.admin.id, update);
                await ActivityLog.create({
                    adminId: req.admin.id,
                    action: "update",
                    entityType: "profile",
                    details: update
                });
                result = { ok: true, message: "Profile updated successfully" };
                break;
            }

            case "add_item": {
                const p = action.params || {};
                if (!p.name) return res.status(400).json({ message: "Item name is required" });
                let collectionId = null;
                let collectionName = "";
                if (p.collectionName) {
                    let col = await Entity.findOne({ type: "collection", name: p.collectionName }).lean();
                    if (!col) {
                        col = await Entity.create({ type: "collection", name: p.collectionName, status: "active", sortOrder: 0 });
                    }
                    collectionId = col._id;
                    collectionName = col.name;
                }

                const created = await Entity.create({
                    type: "item",
                    name: p.name,
                    description: p.description || "",
                    status: p.status || "active",
                    sortOrder: p.sortOrder || 0,
                    tags: Array.isArray(p.tags) ? p.tags : [],
                    collectionId,
                    collectionName
                });
                await ActivityLog.create({
                    adminId: req.admin.id,
                    action: "create",
                    entityType: "item",
                    entityId: created._id,
                    entityName: created.name
                });
                result = { ok: true, message: `Item "${created.name}" created`, entity: created };
                break;
            }

            case "edit_item": {
                const p = action.params || {};
                if (!p.name) return res.status(400).json({ message: "Item name is required for edit" });
                const item = await Entity.findOne({ type: "item", name: new RegExp(`^${escapeRegex(p.name)}$`, "i") });
                if (!item) return res.status(404).json({ message: `Item "${p.name}" not found` });

                const update = {};
                if (p.newName) update.name = p.newName;
                if (p.description !== undefined) update.description = p.description;
                if (p.status) update.status = p.status;
                if (p.sortOrder !== undefined) update.sortOrder = p.sortOrder;
                if (p.tags) update.tags = p.tags;

                if (p.collectionName) {
                    let col = await Entity.findOne({ type: "collection", name: p.collectionName }).lean();
                    if (!col) {
                        col = await Entity.create({ type: "collection", name: p.collectionName, status: "active", sortOrder: 0 });
                    }
                    update.collectionId = col._id;
                    update.collectionName = col.name;
                }
                if (!Object.keys(update).length) {
                    return res.status(400).json({ message: "No item fields to update" });
                }

                const saved = await Entity.findByIdAndUpdate(item._id, update, { new: true });
                await ActivityLog.create({
                    adminId: req.admin.id,
                    action: "update",
                    entityType: "item",
                    entityId: saved._id,
                    entityName: saved.name,
                    details: update
                });
                result = { ok: true, message: `Item "${saved.name}" updated`, entity: saved };
                break;
            }

            case "delete_item": {
                const p = action.params || {};
                if (!p.name) return res.status(400).json({ message: "Item name is required for delete" });
                const item = await Entity.findOne({ type: "item", name: new RegExp(`^${escapeRegex(p.name)}$`, "i") });
                if (!item) return res.status(404).json({ message: `Item "${p.name}" not found` });

                await Entity.findByIdAndDelete(item._id);
                await ActivityLog.create({
                    adminId: req.admin.id,
                    action: "delete",
                    entityType: "item",
                    entityId: item._id,
                    entityName: item.name
                });
                result = { ok: true, message: `Item "${item.name}" deleted` };
                break;
            }

            case "add_collection": {
                const p = action.params || {};
                if (!p.name) return res.status(400).json({ message: "Collection name is required" });
                const exists = await Entity.findOne({ type: "collection", name: p.name }).lean();
                if (exists) return res.status(400).json({ message: `Collection "${p.name}" already exists` });

                const created = await Entity.create({
                    type: "collection",
                    name: p.name,
                    description: p.description || "",
                    status: p.status || "active",
                    sortOrder: p.sortOrder || 0,
                    tags: Array.isArray(p.tags) ? p.tags : []
                });
                await ActivityLog.create({
                    adminId: req.admin.id,
                    action: "create",
                    entityType: "collection",
                    entityId: created._id,
                    entityName: created.name
                });
                result = { ok: true, message: `Collection "${created.name}" created`, entity: created };
                break;
            }

            case "edit_collection": {
                const p = action.params || {};
                if (!p.name) return res.status(400).json({ message: "Collection name is required for edit" });
                const col = await Entity.findOne({ type: "collection", name: new RegExp(`^${escapeRegex(p.name)}$`, "i") });
                if (!col) return res.status(404).json({ message: `Collection "${p.name}" not found` });

                const update = {};
                if (p.newName) update.name = p.newName;
                if (p.description !== undefined) update.description = p.description;
                if (p.status) update.status = p.status;
                if (p.sortOrder !== undefined) update.sortOrder = p.sortOrder;

                if (update.name && update.name !== col.name) {
                    await Entity.updateMany(
                        { type: "item", collectionId: col._id },
                        { $set: { collectionName: update.name } }
                    );
                }
                if (!Object.keys(update).length) {
                    return res.status(400).json({ message: "No collection fields to update" });
                }

                const saved = await Entity.findByIdAndUpdate(col._id, update, { new: true });
                await ActivityLog.create({
                    adminId: req.admin.id,
                    action: "update",
                    entityType: "collection",
                    entityId: saved._id,
                    entityName: saved.name,
                    details: update
                });
                result = { ok: true, message: `Collection "${saved.name}" updated`, entity: saved };
                break;
            }

            case "delete_collection": {
                const p = action.params || {};
                if (!p.name) return res.status(400).json({ message: "Collection name is required for delete" });
                const col = await Entity.findOne({ type: "collection", name: new RegExp(`^${escapeRegex(p.name)}$`, "i") });
                if (!col) return res.status(404).json({ message: `Collection "${p.name}" not found` });

                const itemCount = await Entity.countDocuments({ type: "item", collectionId: col._id });
                if (itemCount > 0) {
                    return res.status(400).json({
                        message: `Cannot delete "${col.name}" - ${itemCount} item(s) are linked. Move them first.`
                    });
                }

                await Entity.findByIdAndDelete(col._id);
                await ActivityLog.create({
                    adminId: req.admin.id,
                    action: "delete",
                    entityType: "collection",
                    entityId: col._id,
                    entityName: col.name
                });
                result = { ok: true, message: `Collection "${col.name}" deleted` };
                break;
            }

            case "list_items": {
                const filter = { type: "item" };
                if (action.params.status) filter.status = action.params.status;
                if (action.params.collectionName) {
                    filter.collectionName = new RegExp(escapeRegex(action.params.collectionName), "i");
                }
                const items = await Entity.find(filter).sort({ sortOrder: 1 }).lean();
                result = { ok: true, items, message: `Found ${items.length} item(s)` };
                break;
            }

            case "list_collections": {
                const collections = await Entity.find({ type: "collection" }).sort({ name: 1 }).lean();
                result = { ok: true, collections, message: `Found ${collections.length} collection(s)` };
                break;
            }

            case "add_mill": {
                const p = action.params || {};
                if (!p.name) return res.status(400).json({ message: "Mill name is required" });
                const created = await Mill.create({
                    name: String(p.name).trim(),
                    location: String(p.location || "").trim(),
                    contactPerson: String(p.contactPerson || "").trim(),
                    phone: String(p.phone || "").trim(),
                    status: ["active", "inactive"].includes(p.status) ? p.status : "active",
                    notes: String(p.notes || "")
                });
                result = { ok: true, message: `Mill \"${created.name}\" created`, entity: created };
                break;
            }

            case "edit_mill": {
                const p = action.params || {};
                const mill = await Mill.findOne({ name: new RegExp(`^${escapeRegex(p.name || "")}$`, "i") });
                if (!mill) return res.status(404).json({ message: `Mill \"${p.name}\" not found` });
                const update = {};
                if (p.newName) update.name = String(p.newName).trim();
                if (p.location !== undefined) update.location = String(p.location).trim();
                if (p.contactPerson !== undefined) update.contactPerson = String(p.contactPerson).trim();
                if (p.phone !== undefined) update.phone = String(p.phone).trim();
                if (p.status && ["active", "inactive"].includes(p.status)) update.status = p.status;
                if (p.notes !== undefined) update.notes = String(p.notes);
                const saved = await Mill.findByIdAndUpdate(mill._id, update, { new: true });
                result = { ok: true, message: `Mill \"${saved.name}\" updated`, entity: saved };
                break;
            }

            case "delete_mill": {
                const p = action.params || {};
                const mill = await Mill.findOne({ name: new RegExp(`^${escapeRegex(p.name || "")}$`, "i") });
                if (!mill) return res.status(404).json({ message: `Mill \"${p.name}\" not found` });
                await Mill.findByIdAndDelete(mill._id);
                result = { ok: true, message: `Mill \"${mill.name}\" deleted` };
                break;
            }

            case "add_quantity": {
                const p = action.params || {};
                if (!p.label) return res.status(400).json({ message: "Quantity label is required" });
                const value = Number(p.value);
                if (!Number.isFinite(value)) return res.status(400).json({ message: "Quantity value must be numeric" });
                const created = await Quantity.create({
                    label: String(p.label).trim(),
                    value,
                    unit: String(p.unit || "pcs").trim(),
                    category: String(p.category || "").trim(),
                    status: ["active", "inactive"].includes(p.status) ? p.status : "active",
                    notes: String(p.notes || "")
                });
                result = { ok: true, message: `Quantity \"${created.label}\" created`, entity: created };
                break;
            }

            case "edit_quantity": {
                const p = action.params || {};
                const quantity = await Quantity.findOne({ label: new RegExp(`^${escapeRegex(p.label || "")}$`, "i") });
                if (!quantity) return res.status(404).json({ message: `Quantity \"${p.label}\" not found` });
                const update = {};
                if (p.newLabel) update.label = String(p.newLabel).trim();
                if (p.value !== undefined) {
                    const value = Number(p.value);
                    if (!Number.isFinite(value)) return res.status(400).json({ message: "Quantity value must be numeric" });
                    update.value = value;
                }
                if (p.unit !== undefined) update.unit = String(p.unit).trim();
                if (p.category !== undefined) update.category = String(p.category).trim();
                if (p.status && ["active", "inactive"].includes(p.status)) update.status = p.status;
                if (p.notes !== undefined) update.notes = String(p.notes);
                const saved = await Quantity.findByIdAndUpdate(quantity._id, update, { new: true });
                result = { ok: true, message: `Quantity \"${saved.label}\" updated`, entity: saved };
                break;
            }

            case "delete_quantity": {
                const p = action.params || {};
                const quantity = await Quantity.findOne({ label: new RegExp(`^${escapeRegex(p.label || "")}$`, "i") });
                if (!quantity) return res.status(404).json({ message: `Quantity \"${p.label}\" not found` });
                await Quantity.findByIdAndDelete(quantity._id);
                result = { ok: true, message: `Quantity \"${quantity.label}\" deleted` };
                break;
            }

            case "add_design_no": {
                const p = action.params || {};
                if (!p.designNumber) return res.status(400).json({ message: "Design number is required" });
                const created = await DesignNo.create({
                    designNumber: String(p.designNumber).trim(),
                    title: String(p.title || "").trim(),
                    category: String(p.category || "").trim(),
                    color: String(p.color || "").trim(),
                    mill: String(p.mill || "").trim(),
                    status: ["active", "inactive"].includes(p.status) ? p.status : "active",
                    notes: String(p.notes || "")
                });
                result = { ok: true, message: `Design number \"${created.designNumber}\" created`, entity: created };
                break;
            }

            case "edit_design_no": {
                const p = action.params || {};
                const design = await DesignNo.findOne({ designNumber: new RegExp(`^${escapeRegex(p.designNumber || "")}$`, "i") });
                if (!design) return res.status(404).json({ message: `Design number \"${p.designNumber}\" not found` });
                const update = {};
                if (p.newDesignNumber) update.designNumber = String(p.newDesignNumber).trim();
                if (p.title !== undefined) update.title = String(p.title).trim();
                if (p.category !== undefined) update.category = String(p.category).trim();
                if (p.color !== undefined) update.color = String(p.color).trim();
                if (p.mill !== undefined) update.mill = String(p.mill).trim();
                if (p.status && ["active", "inactive"].includes(p.status)) update.status = p.status;
                if (p.notes !== undefined) update.notes = String(p.notes);
                const saved = await DesignNo.findByIdAndUpdate(design._id, update, { new: true });
                result = { ok: true, message: `Design number \"${saved.designNumber}\" updated`, entity: saved };
                break;
            }

            case "delete_design_no": {
                const p = action.params || {};
                const design = await DesignNo.findOne({ designNumber: new RegExp(`^${escapeRegex(p.designNumber || "")}$`, "i") });
                if (!design) return res.status(404).json({ message: `Design number \"${p.designNumber}\" not found` });
                await DesignNo.findByIdAndDelete(design._id);
                result = { ok: true, message: `Design number \"${design.designNumber}\" deleted` };
                break;
            }

            case "navigate":
                result = { ok: true, message: "Navigating...", navigateTo: action.params.page || "dashboard" };
                break;

            default:
                return res.status(400).json({ message: "Unsupported action type" });
            }

            executedSuccessfully = true;
            clearAssistantDraft(req.admin.id);
            res.json(result);
        } finally {
            session.execution = {
                ...session.execution,
                inFlight: false,
                lastFingerprint: actionFingerprint,
                lastAt: Date.now()
            };
            if (executedSuccessfully) session.updatedAt = Date.now();
        }
    } catch (e) {
        console.error("Execute error:", e);
        res.status(500).json({ message: e.message || "Failed to execute action" });
    }
});

function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = router;


