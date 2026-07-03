/**
 * server/index.js – FrameCrop Express backend
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const sharp = require("sharp");

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

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
        // Return drive letters
        const { execSync } = require("child_process");
        const drives = execSync("wmic logicaldisk get name", { encoding: "utf8" })
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => /^[A-Z]:$/.test(l))
          .map((d) => d + "\\");
        return res.json({ path: "", entries: drives.map((d) => ({ name: d, type: "folder" })) });
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
        const meta = await sharp(path.join(folder, item.name)).metadata();
        images.push({
          file: item.name,
          width: meta.width,
          height: meta.height,
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
    const buffer = await sharp(filePath)
      .resize({ width: 500, height: 500, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

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

      await sharp(srcPath)
        .extract({
          left: Math.round(cropX),
          top: Math.round(cropY),
          width: Math.round(cropWidth),
          height: Math.round(cropHeight),
        })
        .toFile(outPath);

      results.push({ file, success: true });
    }

    const outDir = path.join(jobs[0].folder, "cropped");
    res.json({ success: true, count: results.length, outputFolder: outDir, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log(`FrameCrop server ready on port ${PORT}`);
});
