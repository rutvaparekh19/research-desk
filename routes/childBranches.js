const express = require("express");
const repository = require("../db/repository");
const { isNonEmptyString, isString, isValidNotes } = require("../db/helpers");
const { asyncHandler, sendNotFound, sendBadRequest } = require("../middleware/errorHandler");

const router = express.Router();

router.get("/", asyncHandler((req, res) => {
    const { branchId } = req.query;

    if (!isNonEmptyString(branchId)) {
        sendBadRequest(res, "branchId query parameter is required");
        return;
    }

    if (!repository.getBranchById(branchId)) {
        sendNotFound(res, "Branch not found");
        return;
    }

    res.json({ childBranches: repository.getChildBranchesByBranchId(branchId) });
}));

router.get("/:id", asyncHandler((req, res) => {
    const childBranch = repository.getChildBranchById(req.params.id);

    if (!childBranch) {
        sendNotFound(res, "Child branch not found");
        return;
    }

    res.json(childBranch);
}));

router.post("/", asyncHandler((req, res) => {
    const { id, branchId, name, description, notes } = req.body;

    if (!isNonEmptyString(id)) {
        sendBadRequest(res, "A valid child branch id is required");
        return;
    }

    if (!isNonEmptyString(branchId)) {
        sendBadRequest(res, "branchId is required");
        return;
    }

    if (!isNonEmptyString(name)) {
        sendBadRequest(res, "Child branch name is required");
        return;
    }

    if (notes !== undefined && !isValidNotes(notes)) {
        sendBadRequest(res, "Notes must be valid TipTap JSON");
        return;
    }

    if (repository.getChildBranchById(id)) {
        sendBadRequest(res, "Child branch id already exists");
        return;
    }

    const childBranch = repository.createChildBranch({
        id,
        branchId,
        name: name.trim(),
        description: isString(description) ? description.trim() : "",
        notes
    });

    if (!childBranch) {
        sendNotFound(res, "Branch not found");
        return;
    }

    res.status(201).json(childBranch);
}));

router.patch("/:id", asyncHandler((req, res) => {
    const { name, description, notes } = req.body;

    if (name !== undefined && !isNonEmptyString(name)) {
        sendBadRequest(res, "Child branch name cannot be empty");
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

    const childBranch = repository.updateChildBranch(req.params.id, {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        notes
    });

    if (!childBranch) {
        sendNotFound(res, "Child branch not found");
        return;
    }

    res.json(childBranch);
}));

router.delete("/:id", asyncHandler((req, res) => {
    const deleted = repository.deleteChildBranch(req.params.id);

    if (!deleted) {
        sendNotFound(res, "Child branch not found");
        return;
    }

    res.status(204).end();
}));

module.exports = router;
