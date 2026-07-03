/**
 * server/index.js – FrameCrop Express backend
 *
 * Uses Jimp (pure JavaScript) for image processing – no native binaries needed.
 * This eliminates platform-specific Sharp installation issues (PRs #3-#5).
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { Jimp } = require("jimp");

// ─── Global error handlers to prevent process crashes ────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[FrameCrop] Uncaught exception (kept alive):", err.stack || err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FrameCrop] Unhandled rejection (kept alive):", reason instanceof Error ? reason.stack : reason);
});

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"]);

function isImage(filename) {
  return IMAGE_EXTS.has(path.extname(filename).toLowerCase());
}

// ─── GET /api/browse ────────────────────────────────────────────────────────
app.get("/api/browse", async (req, res) => {
  try {
    let target = req.query.path ? path.resolve(req.query.path) : "";

    // Default: home directory or drive roots on Windows
    if (!target) {
      if (process.platform === "win32") {
        try {
          const { execSync } = require("child_process");
          const raw = execSync(
            'powershell -NoProfile -Command "[System.IO.DriveInfo]::GetDrives() | ForEach-Object { $_.Name }"',
            { encoding: "utf8", timeout: 5000 }
          );
          const drives = raw
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => /^[A-Z]:\\?$/i.test(l))
            .map((d) => (d.endsWith("\\") ? d : d + "\\"));
          if (drives.length > 0) {
            return res.json({ path: "", entries: drives.map((d) => ({ name: d, type: "folder" })) });
          }
        } catch (driveErr) {
          console.error("[FrameCrop] Could not list drives:", driveErr.message);
        }
      }
      target = os.homedir();
    }

    const entries = [];
    const items = await fs.promises.readdir(target, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith(".")) continue;
      if (item.isDirectory()) {
        entries.push({ name: item.name, type: "folder" });
      }
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ path: target, entries });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── GET /api/images ────────────────────────────────────────────────────────
app.get("/api/images", async (req, res) => {
  try {
    const folder = req.query.folder ? path.resolve(req.query.folder) : "";
    if (!folder) return res.status(400).json({ error: "folder required" });

    const items = await fs.promises.readdir(folder, { withFileTypes: true });
    const images = [];
    for (const item of items) {
      if (!item.isFile() || !isImage(item.name)) continue;
      try {
        const img = await Jimp.read(path.join(folder, item.name));
        images.push({
          file: item.name,
          width: img.width,
          height: img.height,
        });
      } catch (e) {
        // skip unreadable images
      }
    }
    images.sort((a, b) => a.file.localeCompare(b.file));
    res.json({ folder, images });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── GET /api/thumb ─────────────────────────────────────────────────────────
app.get("/api/thumb", async (req, res) => {
  try {
    const { folder, file } = req.query;
    if (!folder || !file) return res.status(400).json({ error: "folder and file required" });

    const resolvedFolder = path.resolve(folder);
    const filePath = path.join(resolvedFolder, path.basename(file));
    const img = await Jimp.read(filePath);

    // Resize to fit within 500x500 without enlarging
    const maxDim = 500;
    if (img.width > maxDim || img.height > maxDim) {
      if (img.width > img.height) {
        img.resize({ w: maxDim });
      } else {
        img.resize({ h: maxDim });
      }
    }

    const buffer = await img.getBuffer("image/jpeg", { quality: 80 });

    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(buffer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/crop ─────────────────────────────────────────────────────────
app.post("/api/crop", async (req, res) => {
  try {
    const jobs = req.body.jobs;
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ error: "jobs array required" });
    }

    const results = [];
    for (const job of jobs) {
      const { folder, file, cropX, cropY, cropWidth, cropHeight } = job;
      const resolvedFolder = path.resolve(folder);
      const srcPath = path.join(resolvedFolder, path.basename(file));
      const outDir = path.join(resolvedFolder, "cropped");
      await fs.promises.mkdir(outDir, { recursive: true });
      const outPath = path.join(outDir, path.basename(file));

      const img = await Jimp.read(srcPath);
      img.crop({
        x: Math.round(cropX),
        y: Math.round(cropY),
        w: Math.round(cropWidth),
        h: Math.round(cropHeight),
      });
      await img.write(outPath);

      results.push({ file, success: true });
    }

    const outDir = path.join(path.resolve(jobs[0].folder), "cropped");
    res.json({ success: true, count: results.length, outputFolder: outDir, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start server ───────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3456;

let activeServer = null;

function startServer(port, retriesRemaining) {
  const server = app.listen(port, () => {
    activeServer = server;
    console.log(`FrameCrop server ready on port ${port}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && retriesRemaining > 0) {
      console.warn(`[FrameCrop] Port ${port} in use, trying ${port + 1}…`);
      startServer(port + 1, retriesRemaining - 1);
    } else {
      console.error("[FrameCrop] Server error:", err.message);
      process.exit(1);
    }
  });
}

function shutdown() {
  if (activeServer) {
    activeServer.close(() => process.exit(0));
    // Force exit after 5 seconds if connections don't close
    setTimeout(() => process.exit(0), 5000).unref();
  } else {
    process.exit(0);
  }
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

startServer(PORT, 3);
