const express = require("express");
const repository = require("../db/repository");
const { isNonEmptyString, isString, isValidNotes } = require("../db/helpers");
const { asyncHandler, sendNotFound, sendBadRequest } = require("../middleware/errorHandler");

const router = express.Router();

router.get("/", asyncHandler((req, res) => {
    res.json({ projects: repository.getAllProjects() });
}));

router.get("/:id", asyncHandler((req, res) => {
    const project = repository.getProjectById(req.params.id);

    if (!project) {
        sendNotFound(res, "Project not found");
        return;
    }

    res.json(project);
}));

router.post("/", asyncHandler((req, res) => {
    const { id, name, description, notes } = req.body;

    if (!isNonEmptyString(id)) {
        sendBadRequest(res, "A valid project id is required");
        return;
    }

    if (!isNonEmptyString(name)) {
        sendBadRequest(res, "Project name is required");
        return;
    }

    if (notes !== undefined && !isValidNotes(notes)) {
        sendBadRequest(res, "Notes must be valid TipTap JSON");
        return;
    }

    if (repository.getProjectById(id)) {
        sendBadRequest(res, "Project id already exists");
        return;
    }

    const project = repository.createProject({
        id,
        name: name.trim(),
        description: isString(description) ? description.trim() : "",
        notes
    });

    res.status(201).json(project);
}));

router.patch("/:id", asyncHandler((req, res) => {
    const { name, description, notes } = req.body;

    if (name !== undefined && !isNonEmptyString(name)) {
        sendBadRequest(res, "Project name cannot be empty");
        return;
    }

    if (description !== undefined && !isString(description)) {
        sendBadRequest(res, "Description must be a string");
        return;
    }

    if (notes !== undefined && !isValidNotes(notes)) {
        sendBadRequest(res, "Notes must be valid TipTap JSON");
        return;
    }

    const project = repository.updateProject(req.params.id, {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        notes
    });

    if (!project) {
        sendNotFound(res, "Project not found");
        return;
    }

    res.json(project);
}));

router.delete("/:id", asyncHandler((req, res) => {
    const deleted = repository.deleteProject(req.params.id);

    if (!deleted) {
        sendNotFound(res, "Project not found");
        return;
    }

    res.status(204).end();
}));

module.exports = router;
