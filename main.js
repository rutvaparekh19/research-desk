const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, shell } = require("electron");

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

app.setName("Research Desk");

let mainWindow = null;
let serverInstance = null;

function setupDatabasePath() {
    const userDataDir = app.getPath("userData");
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    }

    const targetDbPath = path.join(userDataDir, "research.db");

    // First run migration: If userData DB doesn't exist yet, check if project data/research.db exists
    if (!fs.existsSync(targetDbPath)) {
        const legacyDbPath = path.join(__dirname, "data", "research.db");
        if (fs.existsSync(legacyDbPath)) {
            try {
                fs.copyFileSync(legacyDbPath, targetDbPath);
                console.log(`Migrated existing database to ${targetDbPath}`);
            } catch (err) {
                console.error("Failed to copy legacy database:", err);
            }
        }
    }

    // Set RESEARCH_DESK_DB_PATH before requiring any server or DB modules
    process.env.RESEARCH_DESK_DB_PATH = targetDbPath;
    console.log(`Active database path: ${targetDbPath}`);
    return targetDbPath;
}

async function createWindow(serverUrl) {
    const iconPath = process.platform === "win32"
        ? path.join(__dirname, "assets", "icon.ico")
        : path.join(__dirname, "assets", "icon.png");

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 960,
        minHeight: 640,
        title: "Research Desk",
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        autoHideMenuBar: true,
        show: false,
        backgroundColor: "#0f172a",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: path.join(__dirname, "preload.js")
        }
    });

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    // Handle external links in window.open / target="_blank"
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:")) {
            shell.openExternal(url);
        }
        return { action: "deny" };
    });

    // Handle in-window navigation: prevent navigating away from the local application
    mainWindow.webContents.on("will-navigate", (event, url) => {
        const parsedUrl = new URL(url);
        const appUrl = new URL(serverUrl);

        if (parsedUrl.origin !== appUrl.origin) {
            event.preventDefault();
            if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:")) {
                shell.openExternal(url);
            }
        }
    });

    await mainWindow.loadURL(serverUrl);

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

app.on("second-instance", () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.whenReady().then(async () => {
    try {
        setupDatabasePath();

        // Require server after database path is configured
        const { startServer } = require("./server");
        serverInstance = await startServer({ port: 0, host: "127.0.0.1" });

        await createWindow(serverInstance.url);

        app.on("activate", async () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                await createWindow(serverInstance.url);
            }
        });
    } catch (err) {
        console.error("Failed to start application:", err);
        app.quit();
    }
});

let isShuttingDown = false;

async function cleanup() {
    if (isShuttingDown) return;
    isShuttingDown = true;

    try {
        const { stopServer } = require("./server");
        await stopServer();
    } catch (err) {
        console.error("Error during server shutdown:", err);
    }
}

app.on("before-quit", async (event) => {
    if (!isShuttingDown) {
        event.preventDefault();
        await cleanup();
        app.quit();
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
