const express = require("express");
const repository = require("../db/repository");
const { isNonEmptyString, isValidNotes } = require("../db/helpers");
const { asyncHandler, sendNotFound, sendBadRequest } = require("../middleware/errorHandler");

const router = express.Router();

const ENTITY_TYPES = {
    project: "project",
    branch: "branch",
    childBranch: "childBranch"
};

router.get("/:entityType/:entityId", asyncHandler((req, res) => {
    const entityType = ENTITY_TYPES[req.params.entityType];

    if (!entityType) {
        sendBadRequest(res, "entityType must be project, branch, or childBranch");
        return;
    }

    const notes = repository.getNotes(entityType, req.params.entityId);

    if (notes === null) {
        sendNotFound(res, "Entity not found");
        return;
    }

    res.json({ notes });
}));

router.patch("/:entityType/:entityId", asyncHandler((req, res) => {
    const entityType = ENTITY_TYPES[req.params.entityType];

    if (!entityType) {
        sendBadRequest(res, "entityType must be project, branch, or childBranch");
        return;
    }

    const { notes } = req.body;

    if (!isValidNotes(notes)) {
        sendBadRequest(res, "Notes must be valid TipTap JSON");
        return;
    }

    const updatedNotes = repository.updateNotes(entityType, req.params.entityId, notes);

    if (updatedNotes === null) {
        sendNotFound(res, "Entity not found");
        return;
    }

    res.json({ notes: updatedNotes });
}));

module.exports = router;
