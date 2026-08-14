const express = require("express");
const repository = require("../db/repository");
const { isNonEmptyString, isString, isValidNotes } = require("../db/helpers");
const { asyncHandler, sendNotFound, sendBadRequest } = require("../middleware/errorHandler");

const router = express.Router();

router.get("/", asyncHandler((req, res) => {
    const { projectId } = req.query;

    if (!isNonEmptyString(projectId)) {
        sendBadRequest(res, "projectId query parameter is required");
        return;
    }

    if (!repository.getProjectById(projectId)) {
        sendNotFound(res, "Project not found");
        return;
    }

    res.json({ branches: repository.getBranchesByProjectId(projectId) });
}));

router.get("/:id", asyncHandler((req, res) => {
    const branch = repository.getBranchById(req.params.id, { includeProject: true });

    if (!branch) {
        sendNotFound(res, "Branch not found");
        return;
    }

    res.json(branch);
}));

router.post("/", asyncHandler((req, res) => {
    const { id, projectId, name, description, notes } = req.body;

    if (!isNonEmptyString(id)) {
        sendBadRequest(res, "A valid branch id is required");
        return;
    }

    if (!isNonEmptyString(projectId)) {
        sendBadRequest(res, "projectId is required");
        return;
    }

    if (!isNonEmptyString(name)) {
        sendBadRequest(res, "Branch name is required");
        return;
    }

    if (notes !== undefined && !isValidNotes(notes)) {
        sendBadRequest(res, "Notes must be valid TipTap JSON");
        return;
    }

    if (repository.getBranchById(id)) {
        sendBadRequest(res, "Branch id already exists");
        return;
    }

    const branch = repository.createBranch({
        id,
        projectId,
        name: name.trim(),
        description: isString(description) ? description.trim() : "",
        notes
    });

    if (!branch) {
        sendNotFound(res, "Project not found");
        return;
    }

    res.status(201).json(branch);
}));

router.patch("/:id", asyncHandler((req, res) => {
    const { name, description, notes } = req.body;

    if (name !== undefined && !isNonEmptyString(name)) {
        sendBadRequest(res, "Branch name cannot be empty");
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

    const branch = repository.updateBranch(req.params.id, {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        notes
    });

    if (!branch) {
        sendNotFound(res, "Branch not found");
        return;
    }

    res.json(branch);
}));

router.delete("/:id", asyncHandler((req, res) => {
    const deleted = repository.deleteBranch(req.params.id);

    if (!deleted) {
        sendNotFound(res, "Branch not found");
        return;
    }

    res.status(204).end();
}));

module.exports = router;
