const { getDb } = require("./connection");

const EMPTY_NOTES = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

function initializeSchema() {
    const db = getDb();

    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '${EMPTY_NOTES.replace(/'/g, "''")}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS branches (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '${EMPTY_NOTES.replace(/'/g, "''")}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS child_branches (
            id TEXT PRIMARY KEY,
            branch_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '${EMPTY_NOTES.replace(/'/g, "''")}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            branch_id TEXT,
            child_branch_id TEXT,
            name TEXT NOT NULL,
            mime_type TEXT NOT NULL DEFAULT '',
            size INTEGER NOT NULL DEFAULT 0,
            data_url TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
            FOREIGN KEY (child_branch_id) REFERENCES child_branches(id) ON DELETE CASCADE,
            CHECK (
                (branch_id IS NOT NULL AND child_branch_id IS NULL)
                OR (branch_id IS NULL AND child_branch_id IS NOT NULL)
            )
        );

        CREATE TABLE IF NOT EXISTS links (
            id TEXT PRIMARY KEY,
            branch_id TEXT,
            child_branch_id TEXT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
            FOREIGN KEY (child_branch_id) REFERENCES child_branches(id) ON DELETE CASCADE,
            CHECK (
                (branch_id IS NOT NULL AND child_branch_id IS NULL)
                OR (branch_id IS NULL AND child_branch_id IS NOT NULL)
            )
        );

        CREATE INDEX IF NOT EXISTS idx_branches_project_id ON branches(project_id);
        CREATE INDEX IF NOT EXISTS idx_child_branches_branch_id ON child_branches(branch_id);
        CREATE INDEX IF NOT EXISTS idx_files_branch_id ON files(branch_id);
        CREATE INDEX IF NOT EXISTS idx_files_child_branch_id ON files(child_branch_id);
        CREATE INDEX IF NOT EXISTS idx_links_branch_id ON links(branch_id);
        CREATE INDEX IF NOT EXISTS idx_links_child_branch_id ON links(child_branch_id);
    `);
}

module.exports = { initializeSchema, EMPTY_NOTES };
