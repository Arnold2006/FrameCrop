/**
 * FrameCrop – Frontend application
 */
(function () {
  "use strict";

  // ─── State ──────────────────────────────────────────────────────────────────
  let currentFolder = "";
  let images = []; // [{file, width, height, overlay: {x,y,w,h}}]
  let ratioW = 1;
  let ratioH = 1;
  let gridCols = parseInt(localStorage.getItem("framecrop-cols")) || 2;

  // ─── DOM refs ───────────────────────────────────────────────────────────────
  const $grid = document.getElementById("imageGrid");
  const $btnChoose = document.getElementById("btnChooseFolder");
  const $folderLabel = document.getElementById("currentFolder");
  const $btnCropAll = document.getElementById("btnCropAll");
  const $btnTheme = document.getElementById("btnTheme");
  const $statusBar = document.getElementById("statusBar");
  const $modal = document.getElementById("folderModal");
  const $modalPath = document.getElementById("modalPath");
  const $modalBody = document.getElementById("modalBody");
  const $btnCloseModal = document.getElementById("btnCloseModal");
  const $btnSelectFolder = document.getElementById("btnSelectFolder");
  const $customW = document.getElementById("customW");
  const $customH = document.getElementById("customH");

  // ─── Theme ──────────────────────────────────────────────────────────────────
  const savedTheme = localStorage.getItem("framecrop-theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeBtn();

  $btnTheme.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("framecrop-theme", next);
    updateThemeBtn();
  });

  function updateThemeBtn() {
    const t = document.documentElement.getAttribute("data-theme");
    $btnTheme.textContent = t === "dark" ? "☀️" : "🌙";
  }

  // ─── Grid columns ──────────────────────────────────────────────────────────
  setGridCols(gridCols);
  document.querySelectorAll(".btn-grid").forEach((btn) => {
    if (parseInt(btn.dataset.cols) === gridCols) btn.classList.add("active");
    else btn.classList.remove("active");
    btn.addEventListener("click", () => {
      document.querySelectorAll(".btn-grid").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      gridCols = parseInt(btn.dataset.cols);
      localStorage.setItem("framecrop-cols", gridCols);
      setGridCols(gridCols);
    });
  });

  function setGridCols(n) {
    $grid.classList.remove("cols-2", "cols-3");
    $grid.classList.add("cols-" + n);
  }

  // ─── Ratio buttons ─────────────────────────────────────────────────────────
  document.querySelectorAll(".btn-ratio").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".btn-ratio").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const r = btn.dataset.ratio;
      if (r === "custom") {
        ratioW = parseInt($customW.value) || 1;
        ratioH = parseInt($customH.value) || 1;
      } else {
        const parts = r.split(":");
        ratioW = parseInt(parts[0]);
        ratioH = parseInt(parts[1]);
      }
      recalcAllOverlays();
    });
  });

  // ─── Folder browser modal ──────────────────────────────────────────────────
  let browsePath = "";

  $btnChooseFolder.addEventListener("click", () => {
    browsePath = "";
    $modal.classList.remove("hidden");
    loadBrowse("").catch((err) => {
      showBrowseError(err.message);
    });
  });
  $btnCloseModal.addEventListener("click", () => $modal.classList.add("hidden"));
  $btnSelectFolder.addEventListener("click", () => {
    if (browsePath) {
      $modal.classList.add("hidden");
      loadImages(browsePath);
    }
  });

  async function loadBrowse(p) {
    $modalBody.innerHTML = '<div style="padding:16px;color:var(--text-muted)">Loading…</div>';
    $modalPath.textContent = p || "(Root)";

    const url = "/api/browse" + (p ? "?path=" + encodeURIComponent(p) : "");
    const resp = await fetch(url);
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || "Server returned " + resp.status);
    }
    const data = await resp.json();
    browsePath = data.path || "";
    $modalPath.textContent = browsePath || "(Root)";

    $modalBody.innerHTML = "";

    if (!data.entries || data.entries.length === 0) {
      $modalBody.innerHTML = '<div style="padding:16px;color:var(--text-muted)">No subfolders found</div>';
    }

    // Parent link
    if (browsePath) {
      const parent = browsePath.replace(/[\\/][^\\/]+$/, "") || "";
      const el = document.createElement("div");
      el.className = "folder-item parent";
      el.textContent = "⬆️ ..";
      el.addEventListener("click", () => {
        loadBrowse(parent).catch((err) => {
          showBrowseError(err.message);
        });
      });
      $modalBody.appendChild(el);
    }

    for (const entry of data.entries) {
      if (entry.type !== "folder") continue;
      const el = document.createElement("div");
      el.className = "folder-item";
      el.innerHTML = "📁 " + escHtml(entry.name);
      const fullPath = browsePath
        ? browsePath + (browsePath.endsWith("/") || browsePath.endsWith("\\") ? "" : "/") + entry.name
        : entry.name;
      el.addEventListener("click", () => {
        loadBrowse(fullPath).catch((err) => {
          showBrowseError(err.message);
        });
      });
      $modalBody.appendChild(el);
    }
  }

  // ─── Load images ───────────────────────────────────────────────────────────
  async function loadImages(folder) {
    currentFolder = folder;
    $folderLabel.textContent = folder;
    $statusBar.classList.add("hidden");
    $grid.innerHTML = '<p style="padding:20px;color:var(--text-muted)">Loading images…</p>';

    const resp = await fetch("/api/images?folder=" + encodeURIComponent(folder));
    const data = await resp.json();
    if (data.error) {
      $grid.innerHTML = '<p style="padding:20px;color:#ef4444">Error: ' + escHtml(data.error) + "</p>";
      return;
    }

    images = data.images.map((img) => ({
      ...img,
      overlay: null, // will be set after render
    }));

    $btnCropAll.disabled = images.length === 0;
    renderGrid();
  }

  function renderGrid() {
    $grid.innerHTML = "";
    images.forEach((img, idx) => {
      const cell = document.createElement("div");
      cell.className = "image-cell";
      cell.innerHTML = `
        <div class="img-wrapper" data-idx="${idx}">
          <img src="/api/thumb?folder=${encodeURIComponent(currentFolder)}&file=${encodeURIComponent(img.file)}" draggable="false">
        </div>
        <div class="cell-footer">
          <span class="filename">${escHtml(img.file)} (${img.width}×${img.height})</span>
          <button class="btn btn-flip btn-sm" data-idx="${idx}">↔ Flip</button>
        </div>
      `;
      $grid.appendChild(cell);

      // When image loads, set up overlay
      const imgEl = cell.querySelector("img");
      imgEl.addEventListener("load", () => {
        setupOverlay(cell.querySelector(".img-wrapper"), idx, imgEl);
      });

      // Flip button
      cell.querySelector(".btn-flip").addEventListener("click", (e) => {
        flipOverlay(idx);
      });
    });
  }

  // ─── Overlay setup ─────────────────────────────────────────────────────────
  function setupOverlay(wrapper, idx, imgEl) {
    const dispW = imgEl.clientWidth;
    const dispH = imgEl.clientHeight;
    const img = images[idx];

    // Calculate default overlay (largest centered rectangle of target ratio)
    const overlay = calcDefaultOverlay(dispW, dispH);
    img.overlay = overlay;

    renderOverlay(wrapper, idx);
  }

  function calcDefaultOverlay(containerW, containerH) {
    const aspect = ratioW / ratioH;
    let w, h;
    if (containerW / containerH > aspect) {
      h = containerH;
      w = h * aspect;
    } else {
      w = containerW;
      h = w / aspect;
    }
    const x = (containerW - w) / 2;
    const y = (containerH - h) / 2;
    return { x, y, w, h };
  }

  function renderOverlay(wrapper, idx) {
    // Remove existing overlay
    const existing = wrapper.querySelector(".crop-overlay");
    if (existing) existing.remove();
    const existingDim = wrapper.querySelector(".dim-overlay");
    if (existingDim) existingDim.remove();

    const img = images[idx];
    const o = img.overlay;
    if (!o) return;

    const imgEl = wrapper.querySelector("img");
    const dispW = imgEl.clientWidth;
    const dispH = imgEl.clientHeight;

    // Dim overlay (area outside crop)
    const dimEl = document.createElement("div");
    dimEl.className = "dim-overlay";
    dimEl.style.background = `linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0))`;
    dimEl.style.boxShadow = `0 0 0 9999px rgba(0,0,0,0.4)`;
    dimEl.style.left = o.x + "px";
    dimEl.style.top = o.y + "px";
    dimEl.style.width = o.w + "px";
    dimEl.style.height = o.h + "px";
    dimEl.style.position = "absolute";
    wrapper.appendChild(dimEl);

    // Crop overlay
    const overlayEl = document.createElement("div");
    overlayEl.className = "crop-overlay";
    overlayEl.style.left = o.x + "px";
    overlayEl.style.top = o.y + "px";
    overlayEl.style.width = o.w + "px";
    overlayEl.style.height = o.h + "px";

    // Pixel dimensions label
    const scaleX = img.width / dispW;
    const scaleY = img.height / dispH;
    const cropPxW = Math.round(o.w * scaleX);
    const cropPxH = Math.round(o.h * scaleY);
    overlayEl.innerHTML = `
      <span class="crop-dim">${cropPxW}×${cropPxH}</span>
      <div class="crop-handle nw" data-dir="nw"></div>
      <div class="crop-handle n" data-dir="n"></div>
      <div class="crop-handle ne" data-dir="ne"></div>
      <div class="crop-handle w" data-dir="w"></div>
      <div class="crop-handle e" data-dir="e"></div>
      <div class="crop-handle sw" data-dir="sw"></div>
      <div class="crop-handle s" data-dir="s"></div>
      <div class="crop-handle se" data-dir="se"></div>
    `;
    wrapper.appendChild(overlayEl);

    // ── Drag & resize handlers ──
    initDrag(overlayEl, wrapper, idx);
  }

  function initDrag(overlayEl, wrapper, idx) {
    const imgEl = wrapper.querySelector("img");
    let startX, startY, startOX, startOY, startOW, startOH, mode, dir;

    function getPointerPos(e) {
      const rect = wrapper.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { px: clientX - rect.left, py: clientY - rect.top };
    }

    function onPointerDown(e) {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target;
      const pos = getPointerPos(e);
      startX = pos.px;
      startY = pos.py;

      const o = images[idx].overlay;
      startOX = o.x;
      startOY = o.y;
      startOW = o.w;
      startOH = o.h;

      if (target.classList.contains("crop-handle")) {
        mode = "resize";
        dir = target.dataset.dir;
      } else {
        mode = "move";
      }

      document.addEventListener("mousemove", onPointerMove);
      document.addEventListener("mouseup", onPointerUp);
      document.addEventListener("touchmove", onPointerMove, { passive: false });
      document.addEventListener("touchend", onPointerUp);
    }

    function onPointerMove(e) {
      e.preventDefault();
      const pos = getPointerPos(e);
      const dx = pos.px - startX;
      const dy = pos.py - startY;
      const dispW = imgEl.clientWidth;
      const dispH = imgEl.clientHeight;
      const aspect = ratioW / ratioH;

      let o = { x: startOX, y: startOY, w: startOW, h: startOH };

      if (mode === "move") {
        o.x = clamp(startOX + dx, 0, dispW - o.w);
        o.y = clamp(startOY + dy, 0, dispH - o.h);
      } else {
        // Resize with locked aspect ratio
        o = resizeWithAspect(o, dir, dx, dy, aspect, dispW, dispH);
      }

      images[idx].overlay = o;
      updateOverlayDOM(overlayEl, wrapper, idx);
    }

    function onPointerUp() {
      document.removeEventListener("mousemove", onPointerMove);
      document.removeEventListener("mouseup", onPointerUp);
      document.removeEventListener("touchmove", onPointerMove);
      document.removeEventListener("touchend", onPointerUp);
    }

    overlayEl.addEventListener("mousedown", onPointerDown);
    overlayEl.addEventListener("touchstart", onPointerDown, { passive: false });
  }

  function resizeWithAspect(o, dir, dx, dy, aspect, maxW, maxH) {
    let { x, y, w, h } = { x: o.x, y: o.y, w: o.w, h: o.h };
    const minSize = 20;

    // Determine primary delta based on direction
    switch (dir) {
      case "se": {
        w = Math.max(minSize, o.w + dx);
        h = w / aspect;
        break;
      }
      case "nw": {
        w = Math.max(minSize, o.w - dx);
        h = w / aspect;
        x = o.x + o.w - w;
        y = o.y + o.h - h;
        break;
      }
      case "ne": {
        w = Math.max(minSize, o.w + dx);
        h = w / aspect;
        y = o.y + o.h - h;
        break;
      }
      case "sw": {
        w = Math.max(minSize, o.w - dx);
        h = w / aspect;
        x = o.x + o.w - w;
        break;
      }
      case "e": {
        w = Math.max(minSize, o.w + dx);
        h = w / aspect;
        y = o.y + (o.h - h) / 2;
        break;
      }
      case "w": {
        w = Math.max(minSize, o.w - dx);
        h = w / aspect;
        x = o.x + o.w - w;
        y = o.y + (o.h - h) / 2;
        break;
      }
      case "s": {
        h = Math.max(minSize, o.h + dy);
        w = h * aspect;
        x = o.x + (o.w - w) / 2;
        break;
      }
      case "n": {
        h = Math.max(minSize, o.h - dy);
        w = h * aspect;
        x = o.x + (o.w - w) / 2;
        y = o.y + o.h - h;
        break;
      }
    }

    // Clamp to container
    if (x < 0) { x = 0; w = Math.min(w, maxW); h = w / aspect; }
    if (y < 0) { y = 0; h = Math.min(h, maxH); w = h * aspect; }
    if (x + w > maxW) { w = maxW - x; h = w / aspect; }
    if (y + h > maxH) { h = maxH - y; w = h * aspect; }

    // Re-clamp position after size adjustment
    x = clamp(x, 0, maxW - w);
    y = clamp(y, 0, maxH - h);

    return { x, y, w, h };
  }

  function updateOverlayDOM(overlayEl, wrapper, idx) {
    const img = images[idx];
    const o = img.overlay;
    const imgEl = wrapper.querySelector("img");
    const dispW = imgEl.clientWidth;
    const dispH = imgEl.clientHeight;
    const scaleX = img.width / dispW;
    const scaleY = img.height / dispH;

    overlayEl.style.left = o.x + "px";
    overlayEl.style.top = o.y + "px";
    overlayEl.style.width = o.w + "px";
    overlayEl.style.height = o.h + "px";

    const dimEl = wrapper.querySelector(".dim-overlay");
    if (dimEl) {
      dimEl.style.left = o.x + "px";
      dimEl.style.top = o.y + "px";
      dimEl.style.width = o.w + "px";
      dimEl.style.height = o.h + "px";
    }

    const dimLabel = overlayEl.querySelector(".crop-dim");
    if (dimLabel) {
      dimLabel.textContent = Math.round(o.w * scaleX) + "×" + Math.round(o.h * scaleY);
    }
  }

  // ─── Recalculate all overlays ──────────────────────────────────────────────
  function recalcAllOverlays() {
    const wrappers = $grid.querySelectorAll(".img-wrapper");
    wrappers.forEach((wrapper) => {
      const idx = parseInt(wrapper.dataset.idx);
      const imgEl = wrapper.querySelector("img");
      if (!imgEl || !imgEl.complete) return;
      const dispW = imgEl.clientWidth;
      const dispH = imgEl.clientHeight;
      images[idx].overlay = calcDefaultOverlay(dispW, dispH);
      renderOverlay(wrapper, idx);
    });
  }

  // ─── Flip ratio for a single image ─────────────────────────────────────────
  function flipOverlay(idx) {
    const wrapper = $grid.querySelector(`.img-wrapper[data-idx="${idx}"]`);
    if (!wrapper) return;
    const imgEl = wrapper.querySelector("img");
    const dispW = imgEl.clientWidth;
    const dispH = imgEl.clientHeight;

    // Swap ratio for this image
    const flippedAspect = ratioH / ratioW;
    const o = images[idx].overlay;
    const centerX = o.x + o.w / 2;
    const centerY = o.y + o.h / 2;

    let w, h;
    if (dispW / dispH > flippedAspect) {
      h = Math.min(o.h, dispH);
      w = h * flippedAspect;
      if (w > dispW) { w = dispW; h = w / flippedAspect; }
    } else {
      w = Math.min(o.w, dispW);
      h = w / flippedAspect;
      if (h > dispH) { h = dispH; w = h * flippedAspect; }
    }

    let x = centerX - w / 2;
    let y = centerY - h / 2;
    x = clamp(x, 0, dispW - w);
    y = clamp(y, 0, dispH - h);

    images[idx].overlay = { x, y, w, h };
    renderOverlay(wrapper, idx);
  }

  // ─── Crop All & Save ───────────────────────────────────────────────────────
  $btnCropAll.addEventListener("click", async () => {
    if (images.length === 0) return;

    $btnCropAll.disabled = true;
    $statusBar.textContent = "Cropping images…";
    $statusBar.className = "status-bar";

    const jobs = images.map((img) => {
      const wrapper = $grid.querySelector(`.img-wrapper[data-idx="${images.indexOf(img)}"]`);
      const imgEl = wrapper.querySelector("img");
      const dispW = imgEl.clientWidth;
      const dispH = imgEl.clientHeight;
      const scaleX = img.width / dispW;
      const scaleY = img.height / dispH;
      const o = img.overlay;

      return {
        folder: currentFolder,
        file: img.file,
        cropX: Math.round(o.x * scaleX),
        cropY: Math.round(o.y * scaleY),
        cropWidth: Math.round(o.w * scaleX),
        cropHeight: Math.round(o.h * scaleY),
      };
    });

    try {
      const resp = await fetch("/api/crop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs }),
      });
      const data = await resp.json();
      if (data.success) {
        $statusBar.textContent = `✅ ${data.count} images saved to ${data.outputFolder}`;
        $statusBar.className = "status-bar success";
      } else {
        $statusBar.textContent = `❌ Error: ${data.error}`;
        $statusBar.className = "status-bar error";
      }
    } catch (err) {
      $statusBar.textContent = `❌ Error: ${err.message}`;
      $statusBar.className = "status-bar error";
    }
    $btnCropAll.disabled = false;
  });

  // ─── Utilities ─────────────────────────────────────────────────────────────
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function escHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function showBrowseError(msg) {
    $modalBody.innerHTML = '<div style="padding:16px;color:#ef4444">Error: ' + escHtml(msg) + "</div>";
  }
})();
