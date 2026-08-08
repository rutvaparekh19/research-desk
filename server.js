const express = require("express");

const app = express();

const PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
});

// Serve frontend
app.use(express.static("PUBLIC", {
    etag: false,
    setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-store");
    }
}));

// Health check route
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        application: "Research Desk",
        version: "2.0"
    });
});

app.listen(PORT, () => {
    console.log(`Research Desk running at http://localhost:${PORT}`);
});