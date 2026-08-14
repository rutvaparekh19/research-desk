/* ==========================================================
   RESEARCH DESK V2 - TEMPORARY FRONTEND STATE
   ========================================================== */

const App = {
    storageKey: "researchDeskState",
    migrationBackupKey: "researchDeskStateBackup",
    noteSaveTimers: new Map(),

    state: {
        projects: [],
        currentProjectId: null,
        currentBranchId: null,
        currentChildBranchId: null,
        pendingDelete: null
    },

    elements: {},
    editor: null,

    async init() {
        this.cacheElements();
        await this.loadState();
        this.bindEvents();
        this.renderAll();
        this.showView("organization-view");
    },

    /* ==========================================================
       ELEMENTS AND EVENTS
       ========================================================== */

    cacheElements() {
        this.elements.appContainer = document.querySelector(".app-container");

        [
            "organization-view", "project-view", "research-view",
            "project-list", "project-count", "branch-count", "evidence-count",
            "project-title", "project-description", "project-editor", "project-editor-toolbar", "branch-list",
            "project-breadcrumb",
            "research-title", "research-description", "research-editor", "research-editor-toolbar",
            "research-breadcrumb",
            "file-list", "link-list", "child-branch-list",
            "create-child-branch-button", "child-branch-button", "back-to-project",
            "project-modal", "branch-modal", "file-modal", "link-modal", "delete-modal",
            "project-name-input", "project-description-input",
            "branch-name-input", "branch-description-input",
            "file-name-input", "file-input", "link-name-input", "link-url-input",
            "delete-message", "toast-container"
        ].forEach((id) => {
            this.elements[id] = document.getElementById(id);
        });
    },

    bindEvents() {
        this.on("create-project-button", "click", () => this.openProjectModal());
        this.on("organization-create-project", "click", () => this.openProjectModal());
        this.on("save-project", "click", () => this.createProject());
        this.on("cancel-project", "click", () => this.closeModal("project-modal"));

        this.on("add-branch-button", "click", () => this.openBranchModal());
        this.on("create-child-branch-button", "click", () => this.openBranchModal());
        this.on("child-branch-button", "click", () => this.openBranchModal());
        this.on("save-branch", "click", () => this.createBranch());
        this.on("cancel-branch", "click", () => this.closeModal("branch-modal"));

        this.on("add-file-button", "click", () => this.openModal("file-modal"));
        this.on("save-file", "click", () => this.createFile());
        this.on("cancel-file", "click", () => this.closeModal("file-modal"));

        this.on("add-link-button", "click", () => this.openModal("link-modal"));
        this.on("save-link", "click", () => this.createLink());
        this.on("cancel-link", "click", () => this.closeModal("link-modal"));

        this.on("back-to-organization", "click", () => this.goToOrganization());
        this.on("back-to-project", "click", () => this.goBackFromResearch());

        this.on("confirm-delete", "click", () => this.confirmDelete());
        this.on("cancel-delete", "click", () => this.closeDeleteModal());

        this.on("project-title", "blur", () => this.saveProjectDetails());
        this.on("project-description", "blur", () => this.saveProjectDetails());
        this.on("research-title", "blur", () => this.saveWorkspaceDetails());
        this.on("research-description", "blur", () => this.saveWorkspaceDetails());
        document.querySelectorAll(".modal").forEach((modal) => {
            modal.addEventListener("click", (event) => {
                if (event.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                document.querySelectorAll(".modal.active").forEach((modal) => {
                    this.closeModal(modal.id);
                });
            }
        });
    },

    on(id, eventName, handler) {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener(eventName, handler);
        }
    },

    /* ==========================================================
       NAVIGATION AND MODALS
       ========================================================== */

    showView(viewId) {
        if (viewId === "organization-view") {
            this.destroyEditor();
        }

        document.querySelectorAll(".view").forEach((view) => {
            view.classList.toggle("active-view", view.id === viewId);
        });

        this.elements.appContainer.classList.toggle(
            "workspace-active",
            viewId !== "organization-view"
        );
    },

    goToOrganization() {
        this.state.currentProjectId = null;
        this.state.currentBranchId = null;
        this.state.currentChildBranchId = null;
        this.renderAll();
        this.showView("organization-view");
    },

    goBackFromResearch() {
        if (this.state.currentChildBranchId) {
            this.state.currentChildBranchId = null;
            this.openBranch(this.state.currentBranchId);
            return;
        }

        this.openProject(this.state.currentProjectId);
    },

    openModal(id) {
        const modal = this.elements[id];

        if (modal) {
            modal.classList.add("active");
        }
    },

    closeModal(id) {
        const modal = this.elements[id];

        if (modal) {
            modal.classList.remove("active");
        }

        if (id === "delete-modal") {
            this.state.pendingDelete = null;
        }
    },

    openProjectModal() {
        this.clearInputs("project-name-input", "project-description-input");
        this.openModal("project-modal");
        this.elements["project-name-input"].focus();
    },

    openBranchModal() {
        if (!this.getCurrentProject() || this.state.currentChildBranchId) {
            return;
        }

        this.clearInputs("branch-name-input", "branch-description-input");
        this.openModal("branch-modal");
        this.elements["branch-name-input"].focus();
    },

    /* ==========================================================
       PROJECTS AND BRANCHES
       ========================================================== */

    async createProject() {
        const name = this.elements["project-name-input"].value.trim();
        const description = this.elements["project-description-input"].value.trim();

        if (!name) {
            this.showToast("Enter a project name.");
            this.elements["project-name-input"].focus();
            return;
        }

        const project = {
            id: this.makeId("project"),
            name,
            description,
            notes: this.emptyEditorDocument(),
            branches: []
        };

        try {
            const createdProject = await window.ResearchDeskApi.createProject(project);
            this.state.projects.push(this.restoreProject(createdProject));
            this.closeModal("project-modal");
            this.renderAll();
            this.openProject(project.id);
            this.showToast("Project created.");
        } catch (error) {
            this.showToast(error.message || "Project could not be created.");
        }
    },

    openProject(projectId) {
        const project = this.getProject(projectId);

        if (!project) {
            return;
        }

        this.state.currentProjectId = project.id;
        this.state.currentBranchId = null;
        this.state.currentChildBranchId = null;
        this.renderProject();
        this.showView("project-view");
    },

    async createBranch() {
        const project = this.getCurrentProject();
        const name = this.elements["branch-name-input"].value.trim();
        const description = this.elements["branch-description-input"].value.trim();

        if (!project || !name) {
            this.showToast("Enter a branch name.");
            this.elements["branch-name-input"].focus();
            return;
        }

        const branch = this.makeWorkspace(name, description);

        try {
            if (this.state.currentBranchId) {
                const parentBranch = this.getBranch(project, this.state.currentBranchId);

                if (!parentBranch) {
                    return;
                }

                const createdChildBranch = await window.ResearchDeskApi.createChildBranch({
                    id: branch.id,
                    branchId: parentBranch.id,
                    name: branch.name,
                    description: branch.description,
                    notes: branch.notes
                });

                parentBranch.childBranches.push(this.restoreWorkspace(createdChildBranch));
            } else {
                const createdBranch = await window.ResearchDeskApi.createBranch({
                    id: branch.id,
                    projectId: project.id,
                    name: branch.name,
                    description: branch.description,
                    notes: branch.notes
                });

                project.branches.push(this.restoreWorkspace(createdBranch));
            }

            this.closeModal("branch-modal");
            this.renderAll();

            if (this.state.currentBranchId) {
                this.openChildBranch(branch.id);
            } else {
                this.openBranch(branch.id);
            }

            this.showToast("Branch created.");
        } catch (error) {
            this.showToast(error.message || "Branch could not be created.");
        }
    },

    openBranch(branchId) {
        const project = this.getCurrentProject();
        const branch = project && this.getBranch(project, branchId);

        if (!branch) {
            return;
        }

        this.state.currentBranchId = branch.id;
        this.state.currentChildBranchId = null;
        this.renderResearch();
        this.showView("research-view");
    },

    openChildBranch(childBranchId) {
        const project = this.getCurrentProject();
        const branch = project && this.getBranch(project, this.state.currentBranchId);
        const childBranch = branch && branch.childBranches.find((item) => item.id === childBranchId);

        if (!childBranch) {
            return;
        }

        this.state.currentChildBranchId = childBranch.id;
        this.renderResearch();
        this.showView("research-view");
    },

    makeWorkspace(name, description) {
        return {
            id: this.makeId("branch"),
            name,
            description,
            notes: this.emptyEditorDocument(),
            files: [],
            links: [],
            childBranches: []
        };
    },

    /* ==========================================================
       FILES AND LINKS
       ========================================================== */

    createFile() {
        const workspace = this.getCurrentWorkspace();
        const selectedFile = this.elements["file-input"].files[0];
        const enteredName = this.elements["file-name-input"].value.trim();

        if (!workspace || !selectedFile) {
            this.showToast("Choose a file to add.");
            return;
        }

        const reader = new FileReader();

        reader.addEventListener("load", async () => {
            const fileRecord = {
                id: this.makeId("file"),
                name: enteredName || selectedFile.name,
                file: selectedFile,
                dataUrl: typeof reader.result === "string" ? reader.result : null,
                type: selectedFile.type,
                size: selectedFile.size
            };

            try {
                const payload = {
                    id: fileRecord.id,
                    name: fileRecord.name,
                    type: fileRecord.type,
                    size: fileRecord.size,
                    dataUrl: fileRecord.dataUrl
                };

                if (this.state.currentChildBranchId) {
                    payload.childBranchId = this.state.currentChildBranchId;
                } else {
                    payload.branchId = this.state.currentBranchId;
                }

                const createdFile = await window.ResearchDeskApi.createFile(payload);
                workspace.files.push({ ...createdFile, file: selectedFile });
                this.closeModal("file-modal");
                this.clearInputs("file-name-input", "file-input");
                this.renderFiles();
                this.renderStatistics();
                this.showToast("File added.");
            } catch (error) {
                this.showToast(error.message || "The file could not be added.");
            }
        });

        reader.addEventListener("error", () => {
            this.showToast("The file could not be added.");
        });

        reader.readAsDataURL(selectedFile);
    },

    async createLink() {
        const workspace = this.getCurrentWorkspace();
        const name = this.elements["link-name-input"].value.trim();
        const url = this.elements["link-url-input"].value.trim();

        if (!workspace || !url) {
            this.showToast("Enter a valid URL.");
            this.elements["link-url-input"].focus();
            return;
        }

        let parsedUrl;

        try {
            parsedUrl = new URL(url);
        } catch (error) {
            this.showToast("Enter a valid URL.");
            return;
        }

        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            this.showToast("Links must use http or https.");
            return;
        }

        const linkRecord = {
            id: this.makeId("link"),
            name: name || parsedUrl.hostname,
            url: parsedUrl.href
        };

        try {
            const payload = {
                id: linkRecord.id,
                name: linkRecord.name,
                url: linkRecord.url
            };

            if (this.state.currentChildBranchId) {
                payload.childBranchId = this.state.currentChildBranchId;
            } else {
                payload.branchId = this.state.currentBranchId;
            }

            const createdLink = await window.ResearchDeskApi.createLink(payload);
            workspace.links.push(createdLink);
            this.closeModal("link-modal");
            this.clearInputs("link-name-input", "link-url-input");
            this.renderLinks();
            this.renderStatistics();
            this.showToast("Link added.");
        } catch (error) {
            this.showToast(error.message || "Link could not be added.");
        }
    },

    openTemporaryFile(fileId) {
        const workspace = this.getCurrentWorkspace();
        const file = workspace && workspace.files.find((item) => item.id === fileId);

        if (file && (file.file || file.dataUrl)) {
            const source = file.file ? URL.createObjectURL(file.file) : file.dataUrl;
            window.open(source, "_blank", "noopener");
        }
    },

    openLink(linkId) {
        const workspace = this.getCurrentWorkspace();
        const link = workspace && workspace.links.find((item) => item.id === linkId);

        if (link) {
            window.open(link.url, "_blank", "noopener");
        }
    },

    /* ==========================================================
       EDITABLE DETAILS AND NOTES
       ========================================================== */

    async saveProjectDetails() {
        const project = this.getCurrentProject();

        if (!project) {
            return;
        }

        const name = this.elements["project-title"].textContent.trim();
        const description = this.elements["project-description"].textContent.trim();
        project.name = name || project.name;
        project.description = description;

        try {
            await window.ResearchDeskApi.updateProject(project.id, {
                name: project.name,
                description: project.description
            });
            this.renderAll();
        } catch (error) {
            this.showToast(error.message || "Project could not be saved.");
        }
    },

    async saveWorkspaceDetails() {
        const workspace = this.getCurrentWorkspace();

        if (!workspace) {
            return;
        }

        const name = this.elements["research-title"].textContent.trim();
        const description = this.elements["research-description"].textContent.trim();
        workspace.name = name || workspace.name;
        workspace.description = description;

        try {
            if (this.state.currentChildBranchId) {
                await window.ResearchDeskApi.updateChildBranch(workspace.id, {
                    name: workspace.name,
                    description: workspace.description
                });
            } else {
                await window.ResearchDeskApi.updateBranch(workspace.id, {
                    name: workspace.name,
                    description: workspace.description
                });
            }

            this.renderAll();
        } catch (error) {
            this.showToast(error.message || "Workspace could not be saved.");
        }
    },

    saveProjectNotes(notes) {
        const project = this.getCurrentProject();

        if (project) {
            project.notes = notes;
            this.scheduleNotesSave("project", project.id, notes);
        }
    },

    saveWorkspaceNotes(notes) {
        const workspace = this.getCurrentWorkspace();

        if (workspace) {
            workspace.notes = notes;

            if (this.state.currentChildBranchId) {
                this.scheduleNotesSave("childBranch", workspace.id, notes);
            } else {
                this.scheduleNotesSave("branch", workspace.id, notes);
            }
        }
    },

    scheduleNotesSave(entityType, entityId, notes) {
        const timerKey = `${entityType}:${entityId}`;
        const existingTimer = this.noteSaveTimers.get(timerKey);

        if (existingTimer) {
            window.clearTimeout(existingTimer);
        }

        const timer = window.setTimeout(async () => {
            this.noteSaveTimers.delete(timerKey);

            try {
                await window.ResearchDeskApi.updateNotes(entityType, entityId, notes);
            } catch (error) {
                console.warn("Research Desk could not save notes.", error);
            }
        }, 400);

        this.noteSaveTimers.set(timerKey, timer);
    },

    /* ==========================================================
       DELETE CONFIRMATION
       ========================================================== */

    requestDelete(type, id) {
        const messages = {
            project: "Delete this project and all of its branches?",
            branch: "Delete this branch and all of its child branches?",
            childBranch: "Delete this child branch?",
            file: "Delete this file from the workspace?",
            link: "Delete this link from the workspace?"
        };

        this.state.pendingDelete = { type, id };
        this.elements["delete-message"].textContent = messages[type];
        this.openModal("delete-modal");
    },

    closeDeleteModal() {
        this.closeModal("delete-modal");
    },

    async confirmDelete() {
        const pendingDelete = this.state.pendingDelete;

        if (!pendingDelete) {
            return;
        }

        const project = this.getCurrentProject();
        const workspace = this.getCurrentWorkspace();

        try {
            if (pendingDelete.type === "project") {
                await window.ResearchDeskApi.deleteProject(pendingDelete.id);
                this.state.projects = this.state.projects.filter((item) => item.id !== pendingDelete.id);
                this.goToOrganization();
            }

            if (pendingDelete.type === "branch" && project) {
                await window.ResearchDeskApi.deleteBranch(pendingDelete.id);
                project.branches = project.branches.filter((item) => item.id !== pendingDelete.id);
                this.openProject(project.id);
            }

            if (pendingDelete.type === "childBranch" && project) {
                const parentBranch = this.getBranch(project, this.state.currentBranchId);

                if (parentBranch) {
                    this.completeAnimatedRemoval("child-branch-list", pendingDelete.id, async () => {
                        await window.ResearchDeskApi.deleteChildBranch(pendingDelete.id);
                        parentBranch.childBranches = parentBranch.childBranches.filter((item) => item.id !== pendingDelete.id);
                        this.renderChildBranches();
                        this.renderStatistics();
                        this.showToast("Item deleted.");
                    });
                    return;
                }
            }

            if (pendingDelete.type === "file" && workspace) {
                this.completeAnimatedRemoval("file-list", pendingDelete.id, async () => {
                    await window.ResearchDeskApi.deleteFile(pendingDelete.id);
                    workspace.files = workspace.files.filter((item) => item.id !== pendingDelete.id);
                    this.renderFiles();
                    this.renderStatistics();
                    this.showToast("Item deleted.");
                });
                return;
            }

            if (pendingDelete.type === "link" && workspace) {
                this.completeAnimatedRemoval("link-list", pendingDelete.id, async () => {
                    await window.ResearchDeskApi.deleteLink(pendingDelete.id);
                    workspace.links = workspace.links.filter((item) => item.id !== pendingDelete.id);
                    this.renderLinks();
                    this.renderStatistics();
                    this.showToast("Item deleted.");
                });
                return;
            }

            this.state.pendingDelete = null;
            this.closeModal("delete-modal");
            this.renderAll();
            this.showToast("Item deleted.");
        } catch (error) {
            this.showToast(error.message || "Item could not be deleted.");
        }
    },

    /* ==========================================================
       RENDERING
       ========================================================== */

    renderAll() {
        this.renderSidebar();
        this.renderStatistics();

        if (this.getCurrentWorkspace()) {
            this.renderResearch();
        } else if (this.getCurrentProject()) {
            this.renderProject();
        }
    },

    renderSidebar() {
        const list = this.elements["project-list"];
        list.replaceChildren();

        if (!this.state.projects.length) {
            this.renderEmpty(list, "No projects", "Create a project to begin organizing research.");
            return;
        }

        this.state.projects.forEach((project) => {
            list.appendChild(this.createCard({
                className: "project-card",
                icon: "📁",
                title: project.name,
                subtitle: project.description || "No description",
                onOpen: () => this.openProject(project.id),
                onDelete: () => this.requestDelete("project", project.id)
            }));
        });
    },

    renderStatistics() {
        const totals = this.state.projects.reduce((result, project) => {
            project.branches.forEach((branch) => {
                result.branches += 1;
                result.evidence += branch.files.length + branch.links.length;

                branch.childBranches.forEach((childBranch) => {
                    result.branches += 1;
                    result.evidence += childBranch.files.length + childBranch.links.length;
                });
            });

            return result;
        }, { branches: 0, evidence: 0 });

        this.elements["project-count"].textContent = this.state.projects.length;
        this.elements["branch-count"].textContent = totals.branches;
        this.elements["evidence-count"].textContent = totals.evidence;
    },

    renderProject() {
        const project = this.getCurrentProject();

        if (!project) {
            return;
        }

        this.renderEditable(this.elements["project-title"], project.name);
        this.renderEditable(this.elements["project-description"], project.description);
        this.mountEditor({
            element: this.elements["project-editor"],
            toolbar: this.elements["project-editor-toolbar"],
            content: project.notes,
            onUpdate: (notes) => this.saveProjectNotes(notes)
        });
        this.renderBreadcrumb(this.elements["project-breadcrumb"], [
            { label: "Organization Desk", onClick: () => this.goToOrganization() },
            { label: project.name }
        ]);
        this.renderBranches();
    },

    renderBranches() {
        const project = this.getCurrentProject();
        const list = this.elements["branch-list"];
        list.replaceChildren();

        if (!project || !project.branches.length) {
            this.renderEmpty(list, "No branches", "Add a branch to create a research workspace.");
            return;
        }

        project.branches.forEach((branch) => {
            list.appendChild(this.createCard({
                className: "branch-card",
                icon: "◈",
                title: branch.name,
                subtitle: branch.description || "No description",
                onOpen: () => this.openBranch(branch.id),
                onDelete: () => this.requestDelete("branch", branch.id)
            }));
        });
    },

    renderResearch() {
        const workspace = this.getCurrentWorkspace();

        if (!workspace) {
            return;
        }

        const isChildBranch = Boolean(this.state.currentChildBranchId);
        this.renderEditable(this.elements["research-title"], workspace.name);
        this.renderEditable(this.elements["research-description"], workspace.description);
        this.mountEditor({
            element: this.elements["research-editor"],
            toolbar: this.elements["research-editor-toolbar"],
            content: workspace.notes,
            onUpdate: (notes) => this.saveWorkspaceNotes(notes)
        });
        this.elements["back-to-project"].textContent = isChildBranch ? "← Parent Branch" : "← Project";
        this.elements["create-child-branch-button"].hidden = isChildBranch;
        this.elements["child-branch-button"].hidden = isChildBranch;
        this.renderResearchBreadcrumb(workspace, isChildBranch);
        this.renderFiles();
        this.renderLinks();
        this.renderChildBranches();
    },

    renderFiles() {
        const workspace = this.getCurrentWorkspace();
        const list = this.elements["file-list"];
        list.replaceChildren();
        list.classList.remove("is-empty");

        if (!workspace || !workspace.files.length) {
            this.renderEmpty(list, "No files", "Add files as evidence for this branch.");
            return;
        }

        workspace.files.forEach((file) => {
            list.appendChild(this.createCard({
                className: "file-card",
                icon: "▣",
                title: file.name,
                subtitle: this.fileSummary(file),
                itemId: file.id,
                onOpen: () => this.openTemporaryFile(file.id),
                onDelete: () => this.requestDelete("file", file.id)
            }));
        });
    },

    renderLinks() {
        const workspace = this.getCurrentWorkspace();
        const list = this.elements["link-list"];
        list.replaceChildren();
        list.classList.remove("is-empty");

        if (!workspace || !workspace.links.length) {
            this.renderEmpty(list, "No links", "Add web sources as evidence for this branch.");
            return;
        }

        workspace.links.forEach((link) => {
            list.appendChild(this.createCard({
                className: "link-card",
                icon: "↗",
                title: link.name,
                subtitle: link.url,
                itemId: link.id,
                onOpen: () => this.openLink(link.id),
                onDelete: () => this.requestDelete("link", link.id)
            }));
        });
    },

    renderChildBranches() {
        const workspace = this.getCurrentWorkspace();
        const list = this.elements["child-branch-list"];
        list.replaceChildren();
        list.classList.remove("is-empty");

        if (!workspace || !workspace.childBranches.length) {
            this.renderEmpty(list, "No child branches", "Create a child branch to divide this research.");
            return;
        }

        workspace.childBranches.forEach((childBranch) => {
            list.appendChild(this.createCard({
                className: "child-branch-card",
                icon: "◈",
                title: childBranch.name,
                subtitle: childBranch.description || "No description",
                itemId: childBranch.id,
                onOpen: () => this.openChildBranch(childBranch.id),
                onDelete: () => this.requestDelete("childBranch", childBranch.id)
            }));
        });
    },

    createCard({ className, icon, title, subtitle, itemId, onOpen, onDelete }) {
        const card = document.createElement("div");
        const left = document.createElement("div");
        const iconElement = document.createElement("div");
        const text = document.createElement("div");
        const titleElement = document.createElement("div");
        const subtitleElement = document.createElement("div");
        const actions = document.createElement("div");
        const deleteButton = document.createElement("button");

        card.className = className;

        if (itemId) {
            card.dataset.itemId = itemId;
        }

        if (["file-card", "link-card", "child-branch-card"].includes(className)) {
            card.classList.add("collection-card-enter");
        }
        left.className = "card-left";
        iconElement.className = "card-icon";
        titleElement.className = "card-title";
        subtitleElement.className = "card-subtitle";
        actions.className = "card-actions";
        deleteButton.className = "icon-button delete-icon";

        iconElement.textContent = icon;
        titleElement.textContent = title;
        subtitleElement.textContent = subtitle;
        deleteButton.type = "button";
        deleteButton.textContent = "×";
        deleteButton.title = "Delete";

        card.addEventListener("click", onOpen);
        deleteButton.addEventListener("click", (event) => {
            event.stopPropagation();
            onDelete();
        });

        text.append(titleElement, subtitleElement);
        left.append(iconElement, text);
        actions.appendChild(deleteButton);
        card.append(left, actions);
        return card;
    },

    renderEmpty(container, title, message) {
        const empty = document.createElement("div");
        const heading = document.createElement("h3");
        const description = document.createElement("p");

        empty.className = "empty-card";

        if (["file-list", "link-list", "child-branch-list"].includes(container.id)) {
            container.classList.add("is-empty");
            empty.classList.add("compact-empty-state");
        }
        heading.textContent = title;
        description.textContent = message;
        empty.append(heading, description);
        container.appendChild(empty);
    },

    completeAnimatedRemoval(listId, itemId, onComplete) {
        const list = this.elements[listId];
        const card = Array.from(list.children).find((item) => item.dataset.itemId === itemId);

        this.state.pendingDelete = null;
        this.closeModal("delete-modal");

        if (!card) {
            onComplete();
            return;
        }

        card.classList.remove("collection-card-enter");
        card.classList.add("collection-card-exit");
        window.setTimeout(onComplete, 180);
    },

    renderEditable(element, value) {
        element.textContent = value;
        element.contentEditable = "true";
    },

    mountEditor(options) {
        if (!this.editor) {
            this.editor = new window.ResearchDeskEditor();
        }

        this.editor.mount(options);
    },

    destroyEditor() {
        if (this.editor) {
            this.editor.destroy();
        }
    },

    renderResearchBreadcrumb(workspace, isChildBranch) {
        const project = this.getCurrentProject();
        const branch = project && this.getBranch(project, this.state.currentBranchId);
        const items = [
            { label: "Organization Desk", onClick: () => this.goToOrganization() },
            { label: project.name, onClick: () => this.openProject(project.id) }
        ];

        if (isChildBranch) {
            items.push({ label: branch.name, onClick: () => this.openBranch(branch.id) });
        }

        items.push({ label: workspace.name });
        this.renderBreadcrumb(this.elements["research-breadcrumb"], items);
    },

    renderBreadcrumb(container, items) {
        container.replaceChildren();

        items.forEach((item, index) => {
            if (index > 0) {
                const separator = document.createElement("span");
                separator.className = "breadcrumb-separator";
                separator.textContent = "/";
                container.appendChild(separator);
            }

            const isCurrentLocation = index === items.length - 1;
            const element = document.createElement(isCurrentLocation ? "span" : "button");

            element.className = isCurrentLocation ? "breadcrumb-current" : "breadcrumb-link";
            element.textContent = item.label;

            if (!isCurrentLocation) {
                element.type = "button";
                element.addEventListener("click", item.onClick);
            }

            container.appendChild(element);
        });
    },

    /* ==========================================================
       PERSISTENCE AND MIGRATION
       ========================================================== */

    async loadState() {
        try {
            const response = await window.ResearchDeskApi.getProjects();
            this.state.projects = (response.projects || []).map((project) => this.restoreProject(project));

            if (this.state.projects.length) {
                return;
            }

            await this.migrateLocalStorageIfPresent();
        } catch (error) {
            console.warn("Research Desk could not load server data.", error);
            this.showToast("Could not load saved data from the server.");
            this.state.projects = [];
        }
    },

    async migrateLocalStorageIfPresent() {
        const savedState = localStorage.getItem(this.storageKey);

        if (!savedState) {
            return;
        }

        try {
            const parsedState = JSON.parse(savedState);

            if (!this.isStoredStateValid(parsedState) || !parsedState.projects.length) {
                return;
            }

            const migrationResult = await window.ResearchDeskApi.migrateLocalStorage(parsedState.projects);
            this.state.projects = (migrationResult.projects || []).map((project) => this.restoreProject(project));

            localStorage.setItem(this.migrationBackupKey, savedState);
            localStorage.removeItem(this.storageKey);
            this.showToast("Existing browser data migrated to the server.");
        } catch (error) {
            console.warn("Research Desk could not migrate local data.", error);
            this.showToast("Existing browser data could not be migrated.");
        }
    },

    restoreProject(project) {
        return {
            id: project.id,
            name: project.name,
            description: project.description,
            notes: project.notes,
            branches: project.branches.map((branch) => this.restoreWorkspace(branch))
        };
    },

    restoreWorkspace(workspace) {
        return {
            id: workspace.id,
            name: workspace.name,
            description: workspace.description,
            notes: workspace.notes,
            files: workspace.files.map((file) => ({ ...file, file: null })),
            links: workspace.links.map((link) => ({ ...link })),
            childBranches: workspace.childBranches.map((branch) => this.restoreWorkspace(branch))
        };
    },

    isStoredStateValid(savedState) {
        return Boolean(savedState) && Array.isArray(savedState.projects) && savedState.projects.every((project) => (
            this.isStoredProject(project)
        ));
    },

    isStoredProject(project) {
        return this.isStoredEntity(project) && Array.isArray(project.branches) && project.branches.every((branch) => (
            this.isStoredWorkspace(branch)
        ));
    },

    isStoredWorkspace(workspace) {
        return this.isStoredEntity(workspace) &&
            Array.isArray(workspace.files) && workspace.files.every((file) => this.isStoredFile(file)) &&
            Array.isArray(workspace.links) && workspace.links.every((link) => this.isStoredLink(link)) &&
            Array.isArray(workspace.childBranches) && workspace.childBranches.every((branch) => (
                this.isStoredWorkspace(branch)
            ));
    },

    isStoredEntity(entity) {
        return Boolean(entity) &&
            typeof entity.id === "string" &&
            typeof entity.name === "string" &&
            typeof entity.description === "string" &&
            (typeof entity.notes === "string" || this.isEditorDocument(entity.notes));
    },

    isStoredFile(file) {
        return Boolean(file) &&
            typeof file.id === "string" &&
            typeof file.name === "string" &&
            typeof file.type === "string" &&
            typeof file.size === "number" &&
            (typeof file.dataUrl === "string" || file.dataUrl === null);
    },

    isStoredLink(link) {
        return Boolean(link) &&
            typeof link.id === "string" &&
            typeof link.name === "string" &&
            typeof link.url === "string";
    },

    isEditorDocument(notes) {
        return Boolean(notes) && notes.type === "doc" && Array.isArray(notes.content);
    },

    /* ==========================================================
       DATA AND SMALL UTILITIES
       ========================================================== */

    getProject(projectId) {
        return this.state.projects.find((project) => project.id === projectId) || null;
    },

    getCurrentProject() {
        return this.getProject(this.state.currentProjectId);
    },

    getBranch(project, branchId) {
        return project.branches.find((branch) => branch.id === branchId) || null;
    },

    getCurrentWorkspace() {
        const project = this.getCurrentProject();

        if (!project || !this.state.currentBranchId) {
            return null;
        }

        const branch = this.getBranch(project, this.state.currentBranchId);

        if (!branch) {
            return null;
        }

        if (!this.state.currentChildBranchId) {
            return branch;
        }

        return branch.childBranches.find((childBranch) => (
            childBranch.id === this.state.currentChildBranchId
        )) || null;
    },

    makeId(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    },

    emptyEditorDocument() {
        return { type: "doc", content: [{ type: "paragraph" }] };
    },

    clearInputs(...ids) {
        ids.forEach((id) => {
            const input = this.elements[id];

            if (input) {
                input.value = "";
            }
        });
    },

    fileSummary(file) {
        const size = file.size < 1024
            ? `${file.size} B`
            : `${Math.max(1, Math.round(file.size / 1024))} KB`;

        return file.type ? `${file.type} · ${size}` : size;
    },

    showToast(message) {
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        this.elements["toast-container"].appendChild(toast);

        window.setTimeout(() => toast.remove(), 3000);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    App.init().catch((error) => {
        console.error("Research Desk failed to initialize.", error);
    });
});
