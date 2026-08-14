function asyncHandler(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

function sendNotFound(res, message) {
    res.status(404).json({ error: message });
}

function sendBadRequest(res, message) {
    res.status(400).json({ error: message });
}

function errorHandler(error, req, res, next) {
    console.error("API error:", error);

    if (res.headersSent) {
        next(error);
        return;
    }

    res.status(500).json({ error: "Internal server error" });
}

module.exports = {
    asyncHandler,
    sendNotFound,
    sendBadRequest,
    errorHandler
};
