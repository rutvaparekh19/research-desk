const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const TEST_USER_DATA = path.join(__dirname, "..", "data", "test-user-data");
if (fs.existsSync(TEST_USER_DATA)) {
    fs.rmSync(TEST_USER_DATA, { recursive: true, force: true });
}
fs.mkdirSync(TEST_USER_DATA, { recursive: true });

console.log("Starting Electron dev test with userData at:", TEST_USER_DATA);

const electronPath = path.join(__dirname, "..", "node_modules", "electron", "dist", "electron.exe");

const child = spawn(electronPath, [path.join(__dirname, ".."), `--user-data-dir=${TEST_USER_DATA}`], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"]
});

let started = false;

child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    console.log("[ELECTRON STDOUT]", text);
    if (text.includes("Research Desk running at")) {
        started = true;
    }
});

child.stderr.on("data", (chunk) => {
    console.error("[ELECTRON STDERR]", chunk.toString());
});

setTimeout(async () => {
    try {
        console.log("Checking if research.db was created in userData...");
        const dbPath = path.join(TEST_USER_DATA, "research.db");
        console.log("Exists:", fs.existsSync(dbPath));

        child.kill();
        console.log("Electron dev test passed.");
        process.exit(0);
    } catch (err) {
        console.error("Test failed:", err);
        child.kill();
        process.exit(1);
    }
}, 4000);
