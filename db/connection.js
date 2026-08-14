const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = process.env.RESEARCH_DESK_DB_PATH || path.join(DATA_DIR, "research.db");

let db = null;

function getDb() {
    if (!db) {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        db = new Database(DB_PATH);
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

module.exports = { getDb, closeDb, DB_PATH, DATA_DIR };
