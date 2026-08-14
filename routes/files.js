const express = require("express");
const repository = require("../db/repository");
const { isNonEmptyString, isString } = require("../db/helpers");
const { asyncHandler, sendNotFound, sendBadRequest } = require("../middleware/errorHandler");

const router = express.Router();

router.get("/", asyncHandler((req, res) => {
    const { branchId, childBranchId } = req.query;

    if (branchId) {
        if (!repository.getBranchById(branchId)) {
            sendNotFound(res, "Branch not found");
            return;
        }

        res.json({ files: repository.getFilesByBranchId(branchId) });
        return;
    }

    if (childBranchId) {
        if (!repository.getChildBranchById(childBranchId)) {
            sendNotFound(res, "Child branch not found");
            return;
        }

        res.json({ files: repository.getFilesByChildBranchId(childBranchId) });
        return;
    }

    sendBadRequest(res, "branchId or childBranchId query parameter is required");
}));

router.get("/:id", asyncHandler((req, res) => {
    const file = repository.getFileById(req.params.id);

    if (!file) {
        sendNotFound(res, "File not found");
        return;
    }

    res.json(file);
}));

router.post("/", asyncHandler((req, res) => {
    const { id, branchId, childBranchId, name, type, size, dataUrl } = req.body;

    if (!isNonEmptyString(id)) {
        sendBadRequest(res, "A valid file id is required");
        return;
    }

    if (!isNonEmptyString(name)) {
        sendBadRequest(res, "File name is required");
        return;
    }

    if (!branchId && !childBranchId) {
        sendBadRequest(res, "branchId or childBranchId is required");
        return;
    }

    if (branchId && childBranchId) {
        sendBadRequest(res, "Provide either branchId or childBranchId, not both");
        return;
    }

    if (repository.getFileById(id)) {
        sendBadRequest(res, "File id already exists");
        return;
    }

    const file = repository.createFile({
        id,
        branchId: branchId || null,
        childBranchId: childBranchId || null,
        name: name.trim(),
        mimeType: isString(type) ? type : "",
        size: typeof size === "number" ? size : 0,
        dataUrl: isString(dataUrl) ? dataUrl : null
    });

    if (!file) {
        sendNotFound(res, "Workspace not found");
        return;
    }

    res.status(201).json(file);
}));

router.patch("/:id", asyncHandler((req, res) => {
    const { name, type, size, dataUrl } = req.body;

    if (name !== undefined && !isNonEmptyString(name)) {
        sendBadRequest(res, "File name cannot be empty");
        return;
    }

    const file = repository.updateFile(req.params.id, {
        name: name !== undefined ? name.trim() : undefined,
        mimeType: type,
        size,
        dataUrl
    });

    if (!file) {
        sendNotFound(res, "File not found");
        return;
    }

    res.json(file);
}));

router.delete("/:id", asyncHandler((req, res) => {
    const deleted = repository.deleteFile(req.params.id);

    if (!deleted) {
        sendNotFound(res, "File not found");
        return;
    }

    res.status(204).end();
}));

module.exports = router;
