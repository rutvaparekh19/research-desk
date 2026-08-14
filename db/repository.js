const { getDb } = require("./connection");
const { parseNotes, stringifyNotes, mapFileRow, mapLinkRow } = require("./helpers");

function mapChildBranchRow(row, files, links) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        notes: parseNotes(row.notes),
        files: files || [],
        links: links || [],
        childBranches: []
    };
}

function mapBranchRow(row, childBranches, files, links) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        notes: parseNotes(row.notes),
        files: files || [],
        links: links || [],
        childBranches: childBranches || []
    };
}

function mapProjectRow(row, branches) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        notes: parseNotes(row.notes),
        branches: branches || []
    };
}

function getAllProjects() {
    const db = getDb();
    const projects = db.prepare("SELECT * FROM projects ORDER BY created_at ASC").all();

    return projects.map((project) => {
        const branches = db.prepare("SELECT * FROM branches WHERE project_id = ? ORDER BY created_at ASC")
            .all(project.id)
            .map((branch) => getBranchById(branch.id, { includeProject: false }));

        return mapProjectRow(project, branches);
    });
}

function getProjectById(id) {
    const db = getDb();
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);

    if (!project) {
        return null;
    }

    const branches = db.prepare("SELECT * FROM branches WHERE project_id = ? ORDER BY created_at ASC")
        .all(id)
        .map((branch) => getBranchById(branch.id, { includeProject: false }));

    return mapProjectRow(project, branches);
}

function createProject({ id, name, description, notes }) {
    const db = getDb();
    const notesJson = stringifyNotes(notes);

    db.prepare(`
        INSERT INTO projects (id, name, description, notes)
        VALUES (?, ?, ?, ?)
    `).run(id, name, description || "", notesJson);

    return getProjectById(id);
}

function updateProject(id, { name, description, notes }) {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM projects WHERE id = ?").get(id);

    if (!existing) {
        return null;
    }

    const fields = [];
    const values = [];

    if (name !== undefined) {
        fields.push("name = ?");
        values.push(name);
    }

    if (description !== undefined) {
        fields.push("description = ?");
        values.push(description);
    }

    if (notes !== undefined) {
        fields.push("notes = ?");
        values.push(stringifyNotes(notes));
    }

    if (!fields.length) {
        return getProjectById(id);
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);

    return getProjectById(id);
}

function deleteProject(id) {
    const db = getDb();
    const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return result.changes > 0;
}

function getBranchById(id, options = {}) {
    const db = getDb();
    const branch = db.prepare("SELECT * FROM branches WHERE id = ?").get(id);

    if (!branch) {
        return null;
    }

    const childBranches = db.prepare("SELECT * FROM child_branches WHERE branch_id = ? ORDER BY created_at ASC")
        .all(id)
        .map((childBranch) => getChildBranchById(childBranch.id));

    const files = db.prepare("SELECT * FROM files WHERE branch_id = ? ORDER BY created_at ASC")
        .all(id)
        .map(mapFileRow);

    const links = db.prepare("SELECT * FROM links WHERE branch_id = ? ORDER BY created_at ASC")
        .all(id)
        .map(mapLinkRow);

    const mapped = mapBranchRow(branch, childBranches, files, links);

    if (options.includeProject) {
        mapped.projectId = branch.project_id;
    }

    return mapped;
}

function getBranchesByProjectId(projectId) {
    const db = getDb();
    return db.prepare("SELECT * FROM branches WHERE project_id = ? ORDER BY created_at ASC")
        .all(projectId)
        .map((branch) => getBranchById(branch.id));
}

function createBranch({ id, projectId, name, description, notes }) {
    const db = getDb();
    const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);

    if (!project) {
        return null;
    }

    db.prepare(`
        INSERT INTO branches (id, project_id, name, description, notes)
        VALUES (?, ?, ?, ?, ?)
    `).run(id, projectId, name, description || "", stringifyNotes(notes));

    return getBranchById(id, { includeProject: true });
}

function updateBranch(id, { name, description, notes }) {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM branches WHERE id = ?").get(id);

    if (!existing) {
        return null;
    }

    const fields = [];
    const values = [];

    if (name !== undefined) {
        fields.push("name = ?");
        values.push(name);
    }

    if (description !== undefined) {
        fields.push("description = ?");
        values.push(description);
    }

    if (notes !== undefined) {
        fields.push("notes = ?");
        values.push(stringifyNotes(notes));
    }

    if (!fields.length) {
        return getBranchById(id, { includeProject: true });
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE branches SET ${fields.join(", ")} WHERE id = ?`).run(...values);

    return getBranchById(id, { includeProject: true });
}

function deleteBranch(id) {
    const db = getDb();
    const result = db.prepare("DELETE FROM branches WHERE id = ?").run(id);
    return result.changes > 0;
}

function getChildBranchById(id) {
    const db = getDb();
    const childBranch = db.prepare("SELECT * FROM child_branches WHERE id = ?").get(id);

    if (!childBranch) {
        return null;
    }

    const files = db.prepare("SELECT * FROM files WHERE child_branch_id = ? ORDER BY created_at ASC")
        .all(id)
        .map(mapFileRow);

    const links = db.prepare("SELECT * FROM links WHERE child_branch_id = ? ORDER BY created_at ASC")
        .all(id)
        .map(mapLinkRow);

    const mapped = mapChildBranchRow(childBranch, files, links);
    mapped.branchId = childBranch.branch_id;
    return mapped;
}

function getChildBranchesByBranchId(branchId) {
    const db = getDb();
    return db.prepare("SELECT * FROM child_branches WHERE branch_id = ? ORDER BY created_at ASC")
        .all(branchId)
        .map((childBranch) => getChildBranchById(childBranch.id));
}

function createChildBranch({ id, branchId, name, description, notes }) {
    const db = getDb();
    const branch = db.prepare("SELECT id FROM branches WHERE id = ?").get(branchId);

    if (!branch) {
        return null;
    }

    db.prepare(`
        INSERT INTO child_branches (id, branch_id, name, description, notes)
        VALUES (?, ?, ?, ?, ?)
    `).run(id, branchId, name, description || "", stringifyNotes(notes));

    return getChildBranchById(id);
}

function updateChildBranch(id, { name, description, notes }) {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM child_branches WHERE id = ?").get(id);

    if (!existing) {
        return null;
    }

    const fields = [];
    const values = [];

    if (name !== undefined) {
        fields.push("name = ?");
        values.push(name);
    }

    if (description !== undefined) {
        fields.push("description = ?");
        values.push(description);
    }

    if (notes !== undefined) {
        fields.push("notes = ?");
        values.push(stringifyNotes(notes));
    }

    if (!fields.length) {
        return getChildBranchById(id);
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE child_branches SET ${fields.join(", ")} WHERE id = ?`).run(...values);

    return getChildBranchById(id);
}

function deleteChildBranch(id) {
    const db = getDb();
    const result = db.prepare("DELETE FROM child_branches WHERE id = ?").run(id);
    return result.changes > 0;
}

function getNotes(entityType, entityId) {
    const table = {
        project: "projects",
        branch: "branches",
        childBranch: "child_branches"
    }[entityType];

    if (!table) {
        return null;
    }

    const db = getDb();
    const row = db.prepare(`SELECT notes FROM ${table} WHERE id = ?`).get(entityId);

    if (!row) {
        return null;
    }

    return parseNotes(row.notes);
}

function updateNotes(entityType, entityId, notes) {
    const table = {
        project: "projects",
        branch: "branches",
        childBranch: "child_branches"
    }[entityType];

    if (!table) {
        return null;
    }

    const db = getDb();
    const existing = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(entityId);

    if (!existing) {
        return null;
    }

    db.prepare(`UPDATE ${table} SET notes = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(stringifyNotes(notes), entityId);

    return parseNotes(stringifyNotes(notes));
}

function getFileById(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM files WHERE id = ?").get(id);
    return row ? mapFileRow(row) : null;
}

function getFilesByBranchId(branchId) {
    const db = getDb();
    return db.prepare("SELECT * FROM files WHERE branch_id = ? ORDER BY created_at ASC")
        .all(branchId)
        .map(mapFileRow);
}

function getFilesByChildBranchId(childBranchId) {
    const db = getDb();
    return db.prepare("SELECT * FROM files WHERE child_branch_id = ? ORDER BY created_at ASC")
        .all(childBranchId)
        .map(mapFileRow);
}

function createFile({ id, branchId, childBranchId, name, mimeType, size, dataUrl }) {
    const db = getDb();

    if (branchId) {
        const branch = db.prepare("SELECT id FROM branches WHERE id = ?").get(branchId);
        if (!branch) {
            return null;
        }
    } else if (childBranchId) {
        const childBranch = db.prepare("SELECT id FROM child_branches WHERE id = ?").get(childBranchId);
        if (!childBranch) {
            return null;
        }
    } else {
        return null;
    }

    db.prepare(`
        INSERT INTO files (id, branch_id, child_branch_id, name, mime_type, size, data_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, branchId || null, childBranchId || null, name, mimeType || "", size || 0, dataUrl || null);

    return getFileById(id);
}

function updateFile(id, { name, mimeType, size, dataUrl }) {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM files WHERE id = ?").get(id);

    if (!existing) {
        return null;
    }

    const fields = [];
    const values = [];

    if (name !== undefined) {
        fields.push("name = ?");
        values.push(name);
    }

    if (mimeType !== undefined) {
        fields.push("mime_type = ?");
        values.push(mimeType);
    }

    if (size !== undefined) {
        fields.push("size = ?");
        values.push(size);
    }

    if (dataUrl !== undefined) {
        fields.push("data_url = ?");
        values.push(dataUrl);
    }

    if (!fields.length) {
        return getFileById(id);
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE files SET ${fields.join(", ")} WHERE id = ?`).run(...values);

    return getFileById(id);
}

function deleteFile(id) {
    const db = getDb();
    const result = db.prepare("DELETE FROM files WHERE id = ?").run(id);
    return result.changes > 0;
}

function getLinkById(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM links WHERE id = ?").get(id);
    return row ? mapLinkRow(row) : null;
}

function getLinksByBranchId(branchId) {
    const db = getDb();
    return db.prepare("SELECT * FROM links WHERE branch_id = ? ORDER BY created_at ASC")
        .all(branchId)
        .map(mapLinkRow);
}

function getLinksByChildBranchId(childBranchId) {
    const db = getDb();
    return db.prepare("SELECT * FROM links WHERE child_branch_id = ? ORDER BY created_at ASC")
        .all(childBranchId)
        .map(mapLinkRow);
}

function createLink({ id, branchId, childBranchId, name, url }) {
    const db = getDb();

    if (branchId) {
        const branch = db.prepare("SELECT id FROM branches WHERE id = ?").get(branchId);
        if (!branch) {
            return null;
        }
    } else if (childBranchId) {
        const childBranch = db.prepare("SELECT id FROM child_branches WHERE id = ?").get(childBranchId);
        if (!childBranch) {
            return null;
        }
    } else {
        return null;
    }

    db.prepare(`
        INSERT INTO links (id, branch_id, child_branch_id, name, url)
        VALUES (?, ?, ?, ?, ?)
    `).run(id, branchId || null, childBranchId || null, name, url);

    return getLinkById(id);
}

function updateLink(id, { name, url }) {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM links WHERE id = ?").get(id);

    if (!existing) {
        return null;
    }

    const fields = [];
    const values = [];

    if (name !== undefined) {
        fields.push("name = ?");
        values.push(name);
    }

    if (url !== undefined) {
        fields.push("url = ?");
        values.push(url);
    }

    if (!fields.length) {
        return getLinkById(id);
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE links SET ${fields.join(", ")} WHERE id = ?`).run(...values);

    return getLinkById(id);
}

function deleteLink(id) {
    const db = getDb();
    const result = db.prepare("DELETE FROM links WHERE id = ?").run(id);
    return result.changes > 0;
}

function importState(projects) {
    const db = getDb();
    const importTransaction = db.transaction((items) => {
        db.exec("DELETE FROM links");
        db.exec("DELETE FROM files");
        db.exec("DELETE FROM child_branches");
        db.exec("DELETE FROM branches");
        db.exec("DELETE FROM projects");

        for (const project of items) {
            createProject({
                id: project.id,
                name: project.name,
                description: project.description,
                notes: project.notes
            });

            for (const branch of project.branches || []) {
                createBranch({
                    id: branch.id,
                    projectId: project.id,
                    name: branch.name,
                    description: branch.description,
                    notes: branch.notes
                });

                for (const file of branch.files || []) {
                    createFile({
                        id: file.id,
                        branchId: branch.id,
                        name: file.name,
                        mimeType: file.type,
                        size: file.size,
                        dataUrl: file.dataUrl
                    });
                }

                for (const link of branch.links || []) {
                    createLink({
                        id: link.id,
                        branchId: branch.id,
                        name: link.name,
                        url: link.url
                    });
                }

                for (const childBranch of branch.childBranches || []) {
                    createChildBranch({
                        id: childBranch.id,
                        branchId: branch.id,
                        name: childBranch.name,
                        description: childBranch.description,
                        notes: childBranch.notes
                    });

                    for (const file of childBranch.files || []) {
                        createFile({
                            id: file.id,
                            childBranchId: childBranch.id,
                            name: file.name,
                            mimeType: file.type,
                            size: file.size,
                            dataUrl: file.dataUrl
                        });
                    }

                    for (const link of childBranch.links || []) {
                        createLink({
                            id: link.id,
                            childBranchId: childBranch.id,
                            name: link.name,
                            url: link.url
                        });
                    }
                }
            }
        }
    });

    importTransaction(projects);
    return getAllProjects();
}

module.exports = {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    getBranchById,
    getBranchesByProjectId,
    createBranch,
    updateBranch,
    deleteBranch,
    getChildBranchById,
    getChildBranchesByBranchId,
    createChildBranch,
    updateChildBranch,
    deleteChildBranch,
    getNotes,
    updateNotes,
    getFileById,
    getFilesByBranchId,
    getFilesByChildBranchId,
    createFile,
    updateFile,
    deleteFile,
    getLinkById,
    getLinksByBranchId,
    getLinksByChildBranchId,
    createLink,
    updateLink,
    deleteLink,
    importState
};
