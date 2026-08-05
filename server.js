const express = require("express");

const app = express();

const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static("public"));

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