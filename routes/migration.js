const express = require("express");
const repository = require("../db/repository");
const { asyncHandler, sendBadRequest } = require("../middleware/errorHandler");

const router = express.Router();

function isValidStoredProject(project) {
    return Boolean(project) &&
        typeof project.id === "string" &&
        typeof project.name === "string" &&
        typeof project.description === "string" &&
        Array.isArray(project.branches);
}

router.post("/", asyncHandler((req, res) => {
    const { projects } = req.body;

    if (!Array.isArray(projects)) {
        sendBadRequest(res, "projects must be an array");
        return;
    }

    if (!projects.every(isValidStoredProject)) {
        sendBadRequest(res, "Invalid migration payload");
        return;
    }

    const importedProjects = repository.importState(projects);

    res.status(201).json({
        migrated: true,
        projectCount: importedProjects.length,
        projects: importedProjects
    });
}));

module.exports = router;
