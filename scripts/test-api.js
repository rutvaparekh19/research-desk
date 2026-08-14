const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT = 5055;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_DB_PATH = path.join(__dirname, "..", "data", "test-api.db");
process.env.RESEARCH_DESK_DB_PATH = TEST_DB_PATH;

function request(method, route, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = http.request(`${BASE_URL}${route}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {})
            }
        }, (res) => {
            let data = "";

            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                resolve({
                    status: res.statusCode,
                    body: data ? JSON.parse(data) : null
                });
            });
        });

        req.on("error", reject);

        if (payload) {
            req.write(payload);
        }

        req.end();
    });
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function runApiTests() {
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }

    const serverProcess = spawn(process.execPath, ["server.js"], {
        cwd: path.join(__dirname, ".."),
        env: { ...process.env, PORT: String(PORT), RESEARCH_DESK_DB_PATH: TEST_DB_PATH },
        stdio: ["ignore", "pipe", "pipe"]
    });

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Server did not start")), 5000);

        serverProcess.stdout.on("data", (chunk) => {
            if (chunk.toString().includes("Research Desk running")) {
                clearTimeout(timeout);
                resolve();
            }
        });

        serverProcess.stderr.on("data", (chunk) => {
            reject(new Error(chunk.toString()));
        });
    });

    try {
        const health = await request("GET", "/api/health");
        assert(health.status === 200, "Health check should succeed");
        assert(health.body.persistence === "sqlite", "Health check should report sqlite");

        const projectResponse = await request("POST", "/api/projects", {
            id: "project-api-1",
            name: "API Project",
            description: "Created through API",
            notes: { type: "doc", content: [{ type: "paragraph" }] }
        });

        assert(projectResponse.status === 201, "Project create should return 201");

        const branchResponse = await request("POST", "/api/branches", {
            id: "branch-api-1",
            projectId: "project-api-1",
            name: "API Branch",
            description: "Branch via API"
        });

        assert(branchResponse.status === 201, "Branch create should return 201");

        const childBranchResponse = await request("POST", "/api/child-branches", {
            id: "child-api-1",
            branchId: "branch-api-1",
            name: "API Child Branch"
        });

        assert(childBranchResponse.status === 201, "Child branch create should return 201");

        const fileResponse = await request("POST", "/api/files", {
            id: "file-api-1",
            branchId: "branch-api-1",
            name: "notes.txt",
            type: "text/plain",
            size: 12,
            dataUrl: "data:text/plain;base64,dGVzdA=="
        });

        assert(fileResponse.status === 201, "File create should return 201");

        const linkResponse = await request("POST", "/api/links", {
            id: "link-api-1",
            childBranchId: "child-api-1",
            name: "Docs",
            url: "https://example.com/docs"
        });

        assert(linkResponse.status === 201, "Link create should return 201");

        const notesResponse = await request("PATCH", "/api/notes/project/project-api-1", {
            notes: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Saved note" }] }]
            }
        });

        assert(notesResponse.status === 200, "Notes update should succeed");
        assert(notesResponse.body.notes.content[0].content[0].text === "Saved note", "Notes should persist");

        const listResponse = await request("GET", "/api/projects");
        assert(listResponse.status === 200, "Project list should succeed");
        assert(listResponse.body.projects.length === 1, "One project should exist after restart prep");

        serverProcess.kill();
        await new Promise((resolve) => serverProcess.on("exit", resolve));

        const restartProcess = spawn(process.execPath, ["server.js"], {
            cwd: path.join(__dirname, ".."),
            env: { ...process.env, PORT: String(PORT), RESEARCH_DESK_DB_PATH: TEST_DB_PATH },
            stdio: ["ignore", "pipe", "pipe"]
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Restarted server did not start")), 5000);

            restartProcess.stdout.on("data", (chunk) => {
                if (chunk.toString().includes("Research Desk running")) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        const persisted = await request("GET", "/api/projects/project-api-1");
        assert(persisted.status === 200, "Project should survive restart");
        assert(persisted.body.branches.length === 1, "Branch should survive restart");
        assert(persisted.body.branches[0].childBranches.length === 1, "Child branch should survive restart");
        assert(persisted.body.branches[0].files.length === 1, "File should survive restart");
        assert(persisted.body.branches[0].childBranches[0].links.length === 1, "Link should survive restart");
        assert(persisted.body.notes.content[0].content[0].text === "Saved note", "TipTap notes should survive restart");

        restartProcess.kill();
        console.log("All API tests passed.");
    } finally {
        if (!serverProcess.killed) {
            serverProcess.kill();
        }
    }
}

runApiTests().catch((error) => {
    console.error(error);
    process.exit(1);
});
