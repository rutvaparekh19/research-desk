const express = require("express");
const repository = require("../db/repository");
const { isNonEmptyString, isString, isValidUrl } = require("../db/helpers");
const { asyncHandler, sendNotFound, sendBadRequest } = require("../middleware/errorHandler");

const router = express.Router();

router.get("/", asyncHandler((req, res) => {
    const { branchId, childBranchId } = req.query;

    if (branchId) {
        if (!repository.getBranchById(branchId)) {
            sendNotFound(res, "Branch not found");
            return;
        }

        res.json({ links: repository.getLinksByBranchId(branchId) });
        return;
    }

    if (childBranchId) {
        if (!repository.getChildBranchById(childBranchId)) {
            sendNotFound(res, "Child branch not found");
            return;
        }

        res.json({ links: repository.getLinksByChildBranchId(childBranchId) });
        return;
    }

    sendBadRequest(res, "branchId or childBranchId query parameter is required");
}));

router.get("/:id", asyncHandler((req, res) => {
    const link = repository.getLinkById(req.params.id);

    if (!link) {
        sendNotFound(res, "Link not found");
        return;
    }

    res.json(link);
}));

router.post("/", asyncHandler((req, res) => {
    const { id, branchId, childBranchId, name, url } = req.body;

    if (!isNonEmptyString(id)) {
        sendBadRequest(res, "A valid link id is required");
        return;
    }

    if (!isNonEmptyString(name)) {
        sendBadRequest(res, "Link name is required");
        return;
    }

    if (!isValidUrl(url)) {
        sendBadRequest(res, "A valid http or https URL is required");
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

    if (repository.getLinkById(id)) {
        sendBadRequest(res, "Link id already exists");
        return;
    }

    const link = repository.createLink({
        id,
        branchId: branchId || null,
        childBranchId: childBranchId || null,
        name: name.trim(),
        url: isString(url) ? url.trim() : url
    });

    if (!link) {
        sendNotFound(res, "Workspace not found");
        return;
    }

    res.status(201).json(link);
}));

router.patch("/:id", asyncHandler((req, res) => {
    const { name, url } = req.body;

    if (name !== undefined && !isNonEmptyString(name)) {
        sendBadRequest(res, "Link name cannot be empty");
        return;
    }

    if (url !== undefined && !isValidUrl(url)) {
        sendBadRequest(res, "A valid http or https URL is required");
        return;
    }

    const link = repository.updateLink(req.params.id, {
        name: name !== undefined ? name.trim() : undefined,
        url: url !== undefined ? url.trim() : undefined
    });

    if (!link) {
        sendNotFound(res, "Link not found");
        return;
    }

    res.json(link);
}));

router.delete("/:id", asyncHandler((req, res) => {
    const deleted = repository.deleteLink(req.params.id);

    if (!deleted) {
        sendNotFound(res, "Link not found");
        return;
    }

    res.status(204).end();
}));

module.exports = router;
