const express = require("express");
const { initializeSchema } = require("./db/schema");
const { errorHandler } = require("./middleware/errorHandler");
const projectsRouter = require("./routes/projects");
const branchesRouter = require("./routes/branches");
const childBranchesRouter = require("./routes/childBranches");
const notesRouter = require("./routes/notes");
const filesRouter = require("./routes/files");
const linksRouter = require("./routes/links");
const migrationRouter = require("./routes/migration");

const app = express();

const PORT = Number(process.env.PORT) || 5000;

initializeSchema();

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

app.use(express.static("PUBLIC", {
    etag: false,
    setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-store");
    }
}));

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Research Desk running at http://localhost:${PORT}`);
});
