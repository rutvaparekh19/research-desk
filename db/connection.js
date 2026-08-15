const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DEFAULT_DATA_DIR = path.join(__dirname, "..", "data");

let db = null;

function getDbPath() {
    return process.env.RESEARCH_DESK_DB_PATH || path.join(DEFAULT_DATA_DIR, "research.db");
}

function getDb() {
    if (!db) {
        const dbPath = getDbPath();
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        db = new Database(dbPath);
        db.pragma("journal_mode = WAL");
        db.pragma("foreign_keys = ON");
    }

    return db;
}

function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

module.exports = {
    getDb,
    closeDb,
    getDbPath,
    get DB_PATH() {
        return getDbPath();
    },
    get DATA_DIR() {
        return path.dirname(getDbPath());
    }
};

