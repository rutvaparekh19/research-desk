const path = require("path");
const express = require("express");
const { initializeSchema } = require("./db/schema");
const { closeDb } = require("./db/connection");
const { errorHandler } = require("./middleware/errorHandler");
const projectsRouter = require("./routes/projects");
const branchesRouter = require("./routes/branches");
const childBranchesRouter = require("./routes/childBranches");
const notesRouter = require("./routes/notes");
const filesRouter = require("./routes/files");
const linksRouter = require("./routes/links");
const migrationRouter = require("./routes/migration");

function createApp() {
    const app = express();

    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ extended: true }));

    app.get("/favicon.ico", (req, res) => {
        res.status(204).end();
    });

    app.get("/api/health", (req, res) => {
        res.json({
            status: "ok",
            application: "Research Desk",
            version: "2.0",
            persistence: "sqlite"
        });
    });

    app.use("/api/projects", projectsRouter);
    app.use("/api/branches", branchesRouter);
    app.use("/api/child-branches", childBranchesRouter);
    app.use("/api/notes", notesRouter);
    app.use("/api/files", filesRouter);
    app.use("/api/links", linksRouter);
    app.use("/api/migration", migrationRouter);

    const publicDir = path.join(__dirname, "public");
    app.use(express.static(publicDir, {
        etag: false,
        setHeaders: (res) => {
            res.setHeader("Cache-Control", "no-store");
        }
    }));

    app.use(errorHandler);
    return app;
}

let activeServer = null;

function startServer(options = {}) {
    return new Promise((resolve, reject) => {
        if (options.dbPath) {
            process.env.RESEARCH_DESK_DB_PATH = options.dbPath;
        }

        initializeSchema();

        const app = createApp();
        const port = options.port !== undefined ? options.port : (Number(process.env.PORT) || 5000);
        const host = options.host || "127.0.0.1";

        const server = app.listen(port, host, () => {
            const actualPort = server.address().port;
            const url = `http://${host}:${actualPort}`;
            console.log(`Research Desk running at ${url}`);
            activeServer = server;
            resolve({ app, server, port: actualPort, host, url });
        });

        server.on("error", (err) => {
            reject(err);
        });
    });
}

function stopServer() {
    return new Promise((resolve) => {
        if (activeServer) {
            activeServer.close(() => {
                activeServer = null;
                closeDb();
                resolve();
            });
        } else {
            closeDb();
            resolve();
        }
    });
}

if (require.main === module) {
    startServer().catch((err) => {
        console.error("Failed to start server:", err);
        process.exit(1);
    });
}

module.exports = { createApp, startServer, stopServer };

