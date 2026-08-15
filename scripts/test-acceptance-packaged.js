const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

function assert(condition, message) {
    if (!condition) {
        throw new Error("ACCEPTANCE ASSERTION FAILED: " + message);
    }
}

function request(port, method, route, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = http.request(`http://127.0.0.1:${port}${route}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {})
            }
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = data ? JSON.parse(data) : null;
                } catch (e) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, body: parsed });
            });
        });

        req.on("error", reject);
        if (payload) {
            req.write(payload);
        }
        req.end();
    });
}

function launchPackagedApp(testUserDataDir) {
    return new Promise((resolve, reject) => {
        const exePath = path.join(__dirname, "..", "dist", "win-unpacked", "Research Desk.exe");
        assert(fs.existsSync(exePath), `Packaged executable not found at ${exePath}`);

        const child = spawn(exePath, [`--user-data-dir=${testUserDataDir}`], {
            cwd: path.join(__dirname, "..", "dist", "win-unpacked"),
            env: { ...process.env },
            stdio: ["ignore", "pipe", "pipe"]
        });

        let port = null;
        let url = null;

        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error("Timeout waiting for packaged app to start Express server"));
        }, 15000);

        child.stdout.on("data", (chunk) => {
            const text = chunk.toString();
            const match = text.match(/Research Desk running at http:\/\/127\.0\.0\.1:(\d+)/);
            if (match) {
                port = Number(match[1]);
                url = `http://127.0.0.1:${port}`;
                clearTimeout(timeout);
                resolve({ child, port, url });
            }
        });

        child.stderr.on("data", (chunk) => {
            console.log("[PACKAGED STDERR]", chunk.toString());
        });

        child.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

async function runPackagedAcceptanceTests() {
    console.log("==================================================");
    console.log("STARTING PACKAGED ELECTRON ACCEPTANCE TESTS");
    console.log("==================================================");

    const testUserData = path.join(__dirname, "..", "data", "test-packaged-userdata");
    if (fs.existsSync(testUserData)) {
        fs.rmSync(testUserData, { recursive: true, force: true });
    }
    fs.mkdirSync(testUserData, { recursive: true });

    console.log("Step 1 & 2: Launching Packaged Executable (Run #1)...");
    let instance = await launchPackagedApp(testUserData);
    console.log(`Packaged app running on port ${instance.port}`);

    try {
        const health = await request(instance.port, "GET", "/api/health");
        assert(health.status === 200, "Packaged app health endpoint returns 200");
        assert(health.body.application === "Research Desk", "Health reports Research Desk");
        assert(health.body.persistence === "sqlite", "Health reports SQLite persistence");
        console.log("  ✓ Health check verified");

        // Step 3: Check existing projects
        const initialList = await request(instance.port, "GET", "/api/projects");
        assert(initialList.status === 200, "Project list query succeeds");
        console.log(`  ✓ Initial projects list retrieved (count: ${initialList.body.projects.length})`);

        // Step 4: Create a new project
        console.log("Step 4: Creating new project...");
        const projectPayload = {
            id: "acceptance-proj-1",
            name: "Packaged Electron Test Project",
            description: "A project created directly inside the packaged Windows application",
            notes: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Initial project note" }] }]
            }
        };
        const projRes = await request(instance.port, "POST", "/api/projects", projectPayload);
        assert(projRes.status === 201, "Project created successfully with 201");
        console.log("  ✓ Project created:", projRes.body.id);

        // Step 5: Open the project
        console.log("Step 5: Opening project...");
        const projGet = await request(instance.port, "GET", `/api/projects/${projectPayload.id}`);
        assert(projGet.status === 200, "Project retrieved successfully");
        console.log("  ✓ Project opened:", projGet.body.name);

        // Step 6: Create a branch
        console.log("Step 6: Creating branch...");
        const branchPayload = {
            id: "acceptance-branch-1",
            projectId: projectPayload.id,
            name: "Primary Research Branch",
            description: "Branch for deep research testing in packaged Electron"
        };
        const branchRes = await request(instance.port, "POST", "/api/branches", branchPayload);
        assert(branchRes.status === 201, "Branch created with 201");
        console.log("  ✓ Branch created:", branchRes.body.id);

        // Step 7: Create a child branch
        console.log("Step 7: Creating child branch...");
        const childBranchPayload = {
            id: "acceptance-child-1",
            branchId: branchPayload.id,
            name: "Sub-Topic Evidence Branch",
            description: "Child branch testing hierarchy"
        };
        const childBranchRes = await request(instance.port, "POST", "/api/child-branches", childBranchPayload);
        assert(childBranchRes.status === 201, "Child branch created with 201");
        console.log("  ✓ Child branch created:", childBranchRes.body.id);

        // Step 8: Write a TipTap note
        console.log("Step 8: Writing TipTap note...");
        const notePayload = {
            notes: {
                type: "doc",
                content: [
                    {
                        type: "paragraph",
                        content: [
                            { type: "text", text: "Electron Packaged Verification: Rich-text note written to SQLite database." }
                        ]
                    }
                ]
            }
        };
        const noteRes = await request(instance.port, "PATCH", `/api/notes/branch/${branchPayload.id}`, notePayload);
        assert(noteRes.status === 200, "TipTap note update returns 200");
        console.log("  ✓ TipTap note written and saved");

        // Step 9: Add a link
        console.log("Step 9: Adding link...");
        const linkPayload = {
            id: "acceptance-link-1",
            childBranchId: childBranchPayload.id,
            name: "Google DeepMind Documentation",
            url: "https://deepmind.google/technologies"
        };
        const linkRes = await request(instance.port, "POST", "/api/links", linkPayload);
        assert(linkRes.status === 201, "Link created with 201");
        console.log("  ✓ Link added:", linkRes.body.url);

        // Step 10: Add a file
        console.log("Step 10: Adding file attachment...");
        const filePayload = {
            id: "acceptance-file-1",
            branchId: branchPayload.id,
            name: "electron_evidence_log.txt",
            type: "text/plain",
            size: 256,
            dataUrl: "data:text/plain;base64,RWxlY3Ryb24gcGFja2FnZWQgc3VjY2Vzc2Z1bCB2ZXJpZmljYXRpb24h"
        };
        const fileRes = await request(instance.port, "POST", "/api/files", filePayload);
        assert(fileRes.status === 201, "File created with 201");
        console.log("  ✓ File attachment added:", fileRes.body.name);

        // Step 11: Close desktop application completely
        console.log("Step 11: Closing desktop application completely...");
        instance.child.kill();
        await new Promise((r) => setTimeout(r, 1500));
        console.log("  ✓ Application closed cleanly");

        // Verify SQLite database exists in userData directory
        const dbPath = path.join(testUserData, "research.db");
        assert(fs.existsSync(dbPath), `Database file must exist at ${dbPath}`);
        console.log(`  ✓ Persistent database confirmed at ${dbPath} (${fs.statSync(dbPath).size} bytes)`);

        // Step 12: Reopen desktop application (Run #2)
        console.log("Step 12: Reopening desktop application (Run #2)...");
        instance = await launchPackagedApp(testUserData);
        console.log(`Packaged app reopened on port ${instance.port}`);

        // Step 13: Verify all created data is still present
        console.log("Step 13: Verifying all created data survived application restart...");
        const reloadedProj = await request(instance.port, "GET", `/api/projects/${projectPayload.id}`);
        assert(reloadedProj.status === 200, "Project reloaded");
        assert(reloadedProj.body.name === projectPayload.name, "Project name intact");
        assert(reloadedProj.body.branches.length === 1, "Branch count is 1");

        const reloadedBranch = reloadedProj.body.branches[0];
        assert(reloadedBranch.id === branchPayload.id, "Branch ID matches");
        assert(reloadedBranch.files.length === 1, "Branch file count is 1");
        assert(reloadedBranch.files[0].name === filePayload.name, "File name matches");
        assert(reloadedBranch.notes.content[0].content[0].text.includes("Electron Packaged Verification"), "TipTap note text matches");
        assert(reloadedBranch.childBranches.length === 1, "Child branch count is 1");

        const reloadedChild = reloadedBranch.childBranches[0];
        assert(reloadedChild.id === childBranchPayload.id, "Child branch ID matches");
        assert(reloadedChild.links.length === 1, "Child branch link count is 1");
        assert(reloadedChild.links[0].url === linkPayload.url, "Link URL matches");
        console.log("  ✓ All project, branch, child branch, note, file, and link data verified intact!");

        // Step 14: Delete a test item and verify deletion works
        console.log("Step 14: Deleting test item (link)...");
        const delRes = await request(instance.port, "DELETE", `/api/links/${linkPayload.id}`);
        assert(delRes.status === 204, "Link deleted with 204");

        const afterDelProj = await request(instance.port, "GET", `/api/projects/${projectPayload.id}`);
        assert(afterDelProj.body.branches[0].childBranches[0].links.length === 0, "Link confirmed removed");
        console.log("  ✓ Deletion confirmed");

        // Step 15: Close and reopen again (Run #3)
        console.log("Step 15: Closing and reopening application (Run #3)...");
        instance.child.kill();
        await new Promise((r) => setTimeout(r, 1500));

        instance = await launchPackagedApp(testUserData);
        console.log(`Packaged app reopened for Run #3 on port ${instance.port}`);

        // Step 16: Verify remaining data is intact
        console.log("Step 16: Verifying remaining data is intact after second restart...");
        const finalProj = await request(instance.port, "GET", `/api/projects/${projectPayload.id}`);
        assert(finalProj.status === 200, "Project exists");
        assert(finalProj.body.branches.length === 1, "Branch exists");
        assert(finalProj.body.branches[0].files.length === 1, "File exists");
        assert(finalProj.body.branches[0].childBranches.length === 1, "Child branch exists");
        assert(finalProj.body.branches[0].childBranches[0].links.length === 0, "Deleted link remains deleted");
        console.log("  ✓ Final persistence and deletion state confirmed intact!");

        instance.child.kill();
        console.log("==================================================");
        console.log("ALL 16 ACCEPTANCE CRITERIA PASSED ON PACKAGED APP!");
        console.log("==================================================");
    } catch (err) {
        if (instance && instance.child) {
            instance.child.kill();
        }
        throw err;
    }
}

runPackagedAcceptanceTests().then(() => {
    process.exit(0);
}).catch((err) => {
    console.error("PACKAGED ACCEPTANCE TEST FAILED:", err);
    process.exit(1);
});
