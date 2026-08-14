function parseNotes(notesJson) {
    if (!notesJson) {
        return { type: "doc", content: [{ type: "paragraph" }] };
    }

    try {
        return JSON.parse(notesJson);
    } catch (error) {
        return { type: "doc", content: [{ type: "paragraph" }] };
    }
}

function stringifyNotes(notes) {
    if (notes === undefined || notes === null) {
        return JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
    }

    if (typeof notes === "string") {
        return notes;
    }

    return JSON.stringify(notes);
}

function isValidNotes(notes) {
    if (typeof notes === "string") {
        try {
            notes = JSON.parse(notes);
        } catch (error) {
            return false;
        }
    }

    return Boolean(notes) && notes.type === "doc" && Array.isArray(notes.content);
}

function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function isString(value) {
    return typeof value === "string";
}

function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (error) {
        return false;
    }
}

function mapFileRow(row) {
    return {
        id: row.id,
        name: row.name,
        type: row.mime_type,
        size: row.size,
        dataUrl: row.data_url
    };
}

function mapLinkRow(row) {
    return {
        id: row.id,
        name: row.name,
        url: row.url
    };
}

module.exports = {
    parseNotes,
    stringifyNotes,
    isValidNotes,
    isNonEmptyString,
    isString,
    isValidUrl,
    mapFileRow,
    mapLinkRow
};
