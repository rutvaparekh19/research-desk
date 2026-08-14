const ResearchDeskApi = {
    async request(path, options = {}) {
        const response = await fetch(path, {
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            },
            ...options
        });

        if (response.status === 204) {
            return null;
        }

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(payload.error || "Request failed");
        }

        return payload;
    },

    getProjects() {
        return this.request("/api/projects");
    },

    getProject(id) {
        return this.request(`/api/projects/${encodeURIComponent(id)}`);
    },

    createProject(project) {
        return this.request("/api/projects", {
            method: "POST",
            body: JSON.stringify(project)
        });
    },

    updateProject(id, updates) {
        return this.request(`/api/projects/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(updates)
        });
    },

    deleteProject(id) {
        return this.request(`/api/projects/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });
    },

    createBranch(branch) {
        return this.request("/api/branches", {
            method: "POST",
            body: JSON.stringify(branch)
        });
    },

    updateBranch(id, updates) {
        return this.request(`/api/branches/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(updates)
        });
    },

    deleteBranch(id) {
        return this.request(`/api/branches/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });
    },

    createChildBranch(childBranch) {
        return this.request("/api/child-branches", {
            method: "POST",
            body: JSON.stringify(childBranch)
        });
    },

    updateChildBranch(id, updates) {
        return this.request(`/api/child-branches/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(updates)
        });
    },

    deleteChildBranch(id) {
        return this.request(`/api/child-branches/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });
    },

    updateNotes(entityType, entityId, notes) {
        return this.request(`/api/notes/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, {
            method: "PATCH",
            body: JSON.stringify({ notes })
        });
    },

    createFile(file) {
        return this.request("/api/files", {
            method: "POST",
            body: JSON.stringify(file)
        });
    },

    deleteFile(id) {
        return this.request(`/api/files/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });
    },

    createLink(link) {
        return this.request("/api/links", {
            method: "POST",
            body: JSON.stringify(link)
        });
    },

    deleteLink(id) {
        return this.request(`/api/links/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });
    },

    migrateLocalStorage(projects) {
        return this.request("/api/migration", {
            method: "POST",
            body: JSON.stringify({ projects })
        });
    }
};

window.ResearchDeskApi = ResearchDeskApi;
