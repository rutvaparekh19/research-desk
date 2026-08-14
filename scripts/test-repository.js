process.env.RESEARCH_DESK_DB_PATH = require("path").join(__dirname, "..", "data", "test-repository.db");

const { initializeSchema } = require("../db/schema");
const repository = require("../db/repository");
const { closeDb, DB_PATH } = require("../db/connection");
const fs = require("fs");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function runTests() {
    if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
    }

    initializeSchema();

    const project = repository.createProject({
        id: "project-test-1",
        name: "Test Project",
        description: "A test project",
        notes: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Project notes" }] }] }
    });

    assert(project.id === "project-test-1", "Project should be created");
    assert(project.branches.length === 0, "New project should have no branches");

    const branch = repository.createBranch({
        id: "branch-test-1",
        projectId: project.id,
        name: "Main Branch",
        description: "Branch description"
    });

    assert(branch.id === "branch-test-1", "Branch should be created");

    const childBranch = repository.createChildBranch({
        id: "child-test-1",
        branchId: branch.id,
        name: "Child Branch",
        description: "Child description"
    });

    assert(childBranch.id === "child-test-1", "Child branch should be created");

    const file = repository.createFile({
        id: "file-test-1",
        branchId: branch.id,
        name: "Evidence.pdf",
        mimeType: "application/pdf",
        size: 1024,
        dataUrl: "data:application/pdf;base64,abc"
    });

    assert(file.id === "file-test-1", "File should be created on branch");

    const link = repository.createLink({
        id: "link-test-1",
        childBranchId: childBranch.id,
        name: "Example",
        url: "https://example.com"
    });

    assert(link.url === "https://example.com", "Link should be created on child branch");

    const reloaded = repository.getProjectById(project.id);
    assert(reloaded.branches.length === 1, "Project should contain one branch");
    assert(reloaded.branches[0].childBranches.length === 1, "Branch should contain one child branch");
    assert(reloaded.branches[0].files.length === 1, "Branch should contain one file");
    assert(reloaded.branches[0].childBranches[0].links.length === 1, "Child branch should contain one link");
    assert(reloaded.notes.content[0].content[0].text === "Project notes", "TipTap notes should persist");

    repository.deleteProject(project.id);
    assert(repository.getProjectById(project.id) === null, "Deleted project should be gone");
    assert(repository.getBranchById(branch.id) === null, "Branch should cascade delete");
    assert(repository.getChildBranchById(childBranch.id) === null, "Child branch should cascade delete");
    assert(repository.getFileById(file.id) === null, "File should cascade delete");
    assert(repository.getLinkById(link.id) === null, "Link should cascade delete");

    console.log("All repository tests passed.");
}

try {
    runTests();
} finally {
    closeDb();
    if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
    }
}
