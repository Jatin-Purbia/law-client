/* =============================================================
   Agreement Studio — main application logic
   ----------------------------------------------------------------
   Data model
     - Template : { id, name, language, description, builtin, blocks[] }
     - Draft    : { id, name, templateId, language, blocks[], createdAt, updatedAt }
   Storage
     - localStorage["agr_templates"] : Template[]   (user + customised built-ins)
     - drafts are kept in memory only for the current session
   Built-in templates come from window.BUILTIN_TEMPLATES (default-templates.js).
   Built-ins can be edited (the edit lives in localStorage); "Reset Template"
   restores the original.  New drafts always clone from the current template,
   so the template itself stays untouched while the user edits a draft.
   ============================================================= */

(() => {
  "use strict";

  // ------------------------------------------------------------------
  // Visible error catcher — shows any uncaught JS error / rejected
  // promise as a banner so problems are not invisible in production
  // when devtools filters are hiding messages.
  // ------------------------------------------------------------------
  function showErrorBanner(text) {
    let bar = document.getElementById("__errBanner");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "__errBanner";
      bar.style.cssText = [
        "position:fixed",
        "top:0",
        "left:0",
        "right:0",
        "z-index:99999",
        "background:#c0392b",
        "color:#fff",
        "font:13px/1.5 system-ui,sans-serif",
        "padding:10px 44px 10px 14px",
        "box-shadow:0 4px 14px rgba(0,0,0,0.25)",
        "white-space:pre-wrap",
        "max-height:40vh",
        "overflow:auto",
      ].join(";");
      const close = document.createElement("button");
      close.textContent = "✕";
      close.style.cssText =
        "position:absolute;top:6px;right:10px;background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer";
      close.onclick = () => bar.remove();
      bar.appendChild(close);
      document.body.appendChild(bar);
    }
    const line = document.createElement("div");
    line.textContent = text;
    bar.insertBefore(line, bar.firstChild);
  }
  window.addEventListener("error", (e) => {
    showErrorBanner(
      "JS ERROR: " +
        (e.message || "unknown") +
        (e.filename ? ` (${e.filename}:${e.lineno}:${e.colno})` : ""),
    );
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    showErrorBanner(
      "PROMISE REJECTION: " + ((r && (r.message || r.toString())) || "unknown"),
    );
  });

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = (p = "id") =>
    p +
    "_" +
    Math.random().toString(36).slice(2, 9) +
    Date.now().toString(36).slice(-3);
  const clone = (obj) => JSON.parse(JSON.stringify(obj));
  const fmtTime = (ts) => new Date(ts).toLocaleString();
  const asArray = (value) => (Array.isArray(value) ? value : []);
  const assetUrl = (rel) => new URL(rel, document.baseURI).toString();
  const TABLET_BP = 1024;
  const exportCss = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      font-family: 'Noto Serif Devanagari', 'Inter', serif;
      color: #16181f;
    }
    .export-shell {
      padding: 24px;
      background: #fff;
    }
    .export-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin: 0 0 18px;
    }
    .export-btn {
      appearance: none;
      border: 1px solid #cdd5ea;
      background: #1f2230;
      color: #fff;
      border-radius: 999px;
      padding: 10px 18px;
      font: 600 14px/1 inherit;
      cursor: pointer;
    }
    .export-help {
      margin: 0;
      color: #5b6079;
      font-size: 13px;
      line-height: 1.4;
      text-align: center;
    }
    .paper-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      width: 100%;
    }
    .paper {
      background: #fff;
      width: min(794px, 100%);
      max-width: 794px;
      min-height: 1123px;
      margin: 0;
      padding: 80px 90px;
      position: relative;
      font-size: 15.5px;
      line-height: 1.85;
      color: #16181f;
      overflow: visible;
    }
    .page-label {
      position: absolute;
      top: -22px;
      left: 0;
      font-size: 11px;
      color: #7c8299;
      letter-spacing: 0.6px;
      font-weight: 500;
      text-transform: uppercase;
    }
    .page-content { min-height: 1px; outline: none; }
    .page-content h1 {
      font-size: 30px;
      font-weight: 700;
      text-align: center;
      text-decoration: underline;
      text-underline-offset: 8px;
      margin: 6px 0 14px;
      line-height: 1.3;
    }
    .page-content h2 {
      font-size: 19px;
      font-weight: 600;
      margin: 14px 0 8px;
      line-height: 1.4;
    }
    .page-content p {
      margin: 0 0 6px;
      text-align: justify;
      overflow-wrap: break-word;
    }
    .page-content p.small,
    .page-content small { font-size: 14px; }
    .page-content ol,
    .page-content ul {
      padding-left: 28px;
      margin: 4px 0 10px;
    }
    .page-content li { margin: 2px 0; overflow-wrap: break-word; }
    .page-content p.numbered {
      display: grid;
      grid-template-columns: 26px minmax(0, 1fr);
      gap: 6px;
      margin: 6px 0;
      text-align: justify;
    }
    .page-content p.numbered > .num {
      font-weight: 600;
      color: #2c3247;
    }
    .page-content table.two-col {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
    }
    .page-content table.two-col td {
      width: 50%;
      padding: 2px 6px;
      vertical-align: top;
      border: none;
    }
    .page-content table.two-col td:first-child { padding-left: 0; text-align: left; }
    .page-content table.two-col td:last-child  { padding-right: 0; text-align: right; }
    @page { size: A4; margin: 0; }
    @media print {
      body { background: #fff; }
      .export-shell { padding: 0; }
      .export-actions { display: none; }
      .paper {
        width: 210mm;
        min-height: 297mm;
        padding: 22mm 20mm;
        page-break-after: always;
        break-after: page;
      }
      .paper:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    }
  `;

  function closeModal() {
    const modal = $("#modal");
    modal.classList.add("hidden");
    modal.classList.remove("pdf-preview-open");
    modal.onkeydown = null;
    $("#modalConfirm").onclick = null;
    $$("[data-modal-close]", modal).forEach((b) => (b.onclick = null));
  }

  const toast = (msg, ms = 1800) => {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), ms);
  };

  // ------------------------------------------------------------------
  // Built-in templates — fetched once on startup from templates/manifest.json
  // and the JSON files it points to. Must be served over http(s); won't work
  // when opening index.html directly via file:// (browsers block fetch).
  // ------------------------------------------------------------------
  let _builtins = [];

  async function loadBuiltins() {
    if (
      Array.isArray(window.BUILTIN_TEMPLATES) &&
      window.BUILTIN_TEMPLATES.length
    ) {
      _builtins = window.BUILTIN_TEMPLATES.map(clone);
      return;
    }
    const manifestRes = await fetch(assetUrl("templates/manifest.json"), {
      cache: "no-store",
    });
    if (!manifestRes.ok) throw new Error("manifest.json missing or unreadable");
    const manifest = await manifestRes.json();
    const files = asArray(manifest && manifest.templates).filter(
      (f) => typeof f === "string" && f.trim(),
    );
    _builtins = await Promise.all(
      files.map(async (f) => {
        const r = await fetch(assetUrl("templates/" + f), {
          cache: "no-store",
        });
        if (!r.ok)
          throw new Error("Failed to load " + f + " (" + r.status + ")");
        return r.json();
      }),
    );
  }

  // ------------------------------------------------------------------
  // Storage layer
  // ------------------------------------------------------------------
  let draftMemory = [];

  const Store = {
    TPL_KEY: "agr_templates",
    LAST_KEY: "agr_last",

    saveLast(view, id) {
      this._write(this.LAST_KEY, { view, id });
    },
    loadLast() {
      return this._read(this.LAST_KEY, null);
    },

    loadTemplates() {
      const user = asArray(this._read(this.TPL_KEY, []))
        .filter(isDocRecord)
        .map(ensurePagesFormat)
        .filter((t) => !hasLegacyPrefilledRentContent(t))
        .filter(isDocRecord);
      // Merge built-ins with any user-edited overrides. User entries with the
      // same id as a built-in override the built-in.
      const userById = Object.fromEntries(user.map((t) => [t.id, t]));
      const merged = [];
      for (const b of asArray(_builtins).filter(isDocRecord)) {
        const override = userById[b.id];
        merged.push(
          override && docHasMeaningfulPages(override) ? override : clone(b),
        );
      }
      for (const u of user) {
        if (!merged.find((t) => t.id === u.id)) merged.push(u);
      }
      this._write(this.TPL_KEY, user);
      return merged.map(ensurePagesFormat).filter(isDocRecord);
    },
    saveTemplate(tpl) {
      const all = asArray(this._read(this.TPL_KEY, []));
      const idx = all.findIndex((t) => t.id === tpl.id);
      if (idx >= 0) all[idx] = tpl;
      else all.push(tpl);
      this._write(this.TPL_KEY, all);
    },
    deleteTemplate(id) {
      const all = asArray(this._read(this.TPL_KEY, [])).filter(
        (t) => t.id !== id,
      );
      this._write(this.TPL_KEY, all);
    },
    resetBuiltinTemplate(id) {
      const all = asArray(this._read(this.TPL_KEY, [])).filter(
        (t) => t.id !== id,
      );
      this._write(this.TPL_KEY, all);
    },
    loadDrafts() {
      return draftMemory.map(clone).filter(isDocRecord);
    },
    saveDraft(d) {
      const next = clone(ensurePagesFormat(d));
      const idx = draftMemory.findIndex((x) => x.id === next.id);
      if (idx >= 0) draftMemory[idx] = next;
      else draftMemory.unshift(next);
    },
    deleteDraft(id) {
      draftMemory = draftMemory.filter((d) => d.id !== id);
    },

    _read(k, fallback) {
      try {
        return JSON.parse(localStorage.getItem(k)) ?? fallback;
      } catch {
        return fallback;
      }
    },
    _write(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (err) {
        console.warn("localStorage write failed for", k, err);
        showErrorBanner(
          'Could not save local data for "' + k + '": ' + (err.message || err),
        );
      }
    },
  };

  // ------------------------------------------------------------------
  // Application state
  // ------------------------------------------------------------------
  const state = {
    templates: [],
    drafts: [],
    currentMode: "template", // 'template' | 'draft'
    currentId: null,
    currentDoc: null, // active template OR draft
    focusedPageIdx: 0, // index of the page editable that last had focus
    focusedEditable: null, // last-focused contenteditable (target for voice)
    voice: { active: false, recognition: null },
  };

  // ------------------------------------------------------------------
  // Free-write data model
  //   doc.pages : string[]   — each entry is the HTML for one A4 page
  // Older block-format documents are migrated on load via ensurePagesFormat.
  // ------------------------------------------------------------------
  const escapeHtml = (s) =>
    (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const isDocRecord = (value) =>
    !!value && typeof value === "object" && !Array.isArray(value);
  const hasLegacyPrefilledRentContent = (doc) => {
    if (!doc || doc.id !== "rent-agreement-hindi") return false;
    const hay = JSON.stringify(doc);
    return (
      hay.includes("15-05-2026") &&
      hay.includes("302001") &&
      (hay.includes("2,000/-") || hay.includes("2000/-"))
    );
  };

  function blockToHtml(b) {
    if (b.type === "block") {
      const tag =
        b.style === "title" ? "h1" : b.style === "heading" ? "h2" : "p";
      const cls = b.style === "small" ? ' class="small"' : "";
      const align = b.align ? ` style="text-align:${b.align}"` : "";
      const text = escapeHtml(b.text) || "<br>";
      return `<${tag}${cls}${align}>${text}</${tag}>`;
    }
    if (b.type === "numbered") {
      // Inline number — the user can edit the prefix as plain text
      const text = escapeHtml(b.text);
      const num = escapeHtml(b.number || "•");
      return `<p class="numbered"><span class="num">${num}</span> ${text || "<br>"}</p>`;
    }
    if (b.type === "row") {
      const L = escapeHtml(b.left) || "<br>";
      const R = escapeHtml(b.right) || "<br>";
      return `<table class="two-col"><tbody><tr><td>${L}</td><td>${R}</td></tr></tbody></table>`;
    }
    if (b.type === "spacer") {
      const px = b.size === "sm" ? 8 : b.size === "lg" ? 36 : 18;
      return `<div class="spacer" data-size="${b.size || "md"}" style="height:${px}px"></div>`;
    }
    return "";
  }

  function blocksToPages(blocks) {
    const pages = [];
    let buf = [];
    for (const b of blocks) {
      if (b.type === "page-break") {
        pages.push(buf.join(""));
        buf = [];
        continue;
      }
      buf.push(blockToHtml(b));
    }
    pages.push(buf.join(""));
    return pages.length ? pages : ["<p><br></p>"];
  }

  function ensurePagesFormat(doc) {
    if (!doc) return doc;
    // Prefer real rendered pages, but only if they contain actual content.
    // Some older saved records have a pages array that is technically present
    // but blank, while the original block data still exists.
    if (Array.isArray(doc.pages) && doc.pages.length > 0) {
      if (doc.pages.some(pageHasMeaningfulContent)) return doc;
    }
    if (Array.isArray(doc.blocks)) {
      doc.pages = blocksToPages(doc.blocks);
      delete doc.blocks;
      // blocksToPages always returns at least one page, but belt-and-suspenders:
      if (!doc.pages.length) doc.pages = ["<p><br></p>"];
      return doc;
    }
    doc.pages = ["<p><br></p>"];
    return doc;
  }

  function pageHasMeaningfulContent(html) {
    const text = String(html || "")
      .replace(/<br\s*\/?\s*>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim();
    return text.length > 0;
  }

  function docHasMeaningfulPages(doc) {
    return (
      Array.isArray(doc?.pages) && doc.pages.some(pageHasMeaningfulContent)
    );
  }

  // ------------------------------------------------------------------
  // Rendering — each page is one A4 sheet with a single contenteditable
  // surface inside. Free-write: paragraphs/lists/alignments live in the HTML.
  // ------------------------------------------------------------------
  const paper = $("#paper");

  function forceSurfaceStyles(article, content, label) {
    article.style.setProperty("display", "block", "important");
    article.style.setProperty("background", "#fff", "important");
    article.style.setProperty("color", "#16181f", "important");
    article.style.setProperty("visibility", "visible", "important");
    article.style.setProperty("opacity", "1", "important");
    article.style.setProperty("mix-blend-mode", "normal", "important");

    content.style.setProperty("display", "block", "important");
    content.style.setProperty("background", "transparent", "important");
    content.style.setProperty("color", "#16181f", "important");
    content.style.setProperty("visibility", "visible", "important");
    content.style.setProperty("opacity", "1", "important");
    content.style.setProperty("mix-blend-mode", "normal", "important");
    content.style.setProperty(
      "font-family",
      "'Noto Serif Devanagari', 'Inter', serif",
      "important",
    );
    content.style.setProperty("font-kerning", "normal", "important");

    label.style.setProperty("display", "block", "important");
    label.style.setProperty("visibility", "visible", "important");
    label.style.setProperty("opacity", "1", "important");
  }

  function render() {
    paper.innerHTML = "";
    if (!state.currentDoc) {
      const empty = document.createElement("div");
      empty.className = "paper empty-paper";
      empty.textContent =
        "Select a template or draft from the sidebar to begin.";
      paper.appendChild(empty);
      return;
    }

    // Defensive — if pages is missing/empty (corrupted draft, failed migration, etc.),
    // self-heal with an empty page rather than rendering an invisible blank canvas.
    if (
      !Array.isArray(state.currentDoc.pages) ||
      state.currentDoc.pages.length === 0
    ) {
      console.warn(
        "Document had no pages — initializing with a blank page.",
        state.currentDoc,
      );
      state.currentDoc.pages = ["<p><br></p>"];
    }

    const pages = state.currentDoc.pages;
    const total = pages.length;

    pages.forEach((html, idx) => {
      const article = document.createElement("article");
      article.className = "paper";
      article.dataset.pageNum = String(idx + 1);

      const label = document.createElement("div");
      label.className = "page-label";
      label.textContent = `Page ${idx + 1} of ${total}`;
      article.appendChild(label);

      const content = document.createElement("div");
      content.className = "page-content";
      content.contentEditable = "true";
      content.spellcheck = false;
      content.dataset.pageIdx = String(idx);
      content.innerHTML = html || "<p><br></p>";
      forceSurfaceStyles(article, content, label);

      // Lock the "1." / "2." prefix spans on legacy-numbered paragraphs so the
      // caret can't get trapped inside that tiny 26px grid cell (which made
      // dictated text wrap one Devanagari syllable per line).
      content.querySelectorAll("p.numbered > .num").forEach((s) => {
        s.contentEditable = "false";
      });

      // Save typing into the pages array
      content.addEventListener("input", () => {
        state.currentDoc.pages[idx] = content.innerHTML;
        markDirty();
        // Once the user starts typing/formatting, native undo owns this page —
        // drop stale struct snapshots so Ctrl+Z doesn't time-warp past their work.
        structUndoStack.length = 0;
      });
      // Backspace at start of a non-first page → merge with previous page
      content.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && idx > 0 && isCaretAtStartOfPage(content)) {
          e.preventDefault();
          mergePageWithPrevious();
        }
      });
      // Track focus so voice insertion + toolbar know which page to target
      content.addEventListener("focus", () => {
        state.focusedPageIdx = idx;
        state.focusedEditable = content;
      });
      article.appendChild(content);
      paper.appendChild(article);
    });

    // Restore focus to the previously focused page if it still exists
    if (state.focusedPageIdx < total) {
      const target = paper.querySelector(
        `.page-content[data-page-idx="${state.focusedPageIdx}"]`,
      );
      if (target) state.focusedEditable = target;
    } else {
      state.focusedPageIdx = Math.max(0, total - 1);
      state.focusedEditable = paper.querySelector(
        `.page-content[data-page-idx="${state.focusedPageIdx}"]`,
      );
    }
  }

  // ------------------------------------------------------------------
  // Structural undo stack — for ops that re-render the canvas (page break,
  // delete page) and therefore wipe the browser's native contenteditable
  // undo history. Native undo still handles typing/formatting within a page.
  // ------------------------------------------------------------------
  const structUndoStack = [];
  const STRUCT_UNDO_MAX = 25;

  function pushStructUndo() {
    if (!state.currentDoc) return;
    flushFocusedPage(); // capture in-flight typing before snapshotting
    structUndoStack.push({
      pages: clone(state.currentDoc.pages),
      focusedPageIdx: state.focusedPageIdx,
    });
    if (structUndoStack.length > STRUCT_UNDO_MAX) structUndoStack.shift();
  }

  function tryStructUndo() {
    const snap = structUndoStack.pop();
    if (!snap) return false;
    state.currentDoc.pages = snap.pages;
    state.focusedPageIdx = Math.min(snap.focusedPageIdx, snap.pages.length - 1);
    markDirty();
    render();
    requestAnimationFrame(() => {
      const target = paper.querySelector(
        `.page-content[data-page-idx="${state.focusedPageIdx}"]`,
      );
      if (target) {
        target.focus({ preventScroll: false });
        const r = document.createRange();
        r.selectNodeContents(target);
        r.collapse(false);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
    });
    toast("Undone");
    return true;
  }

  // ------------------------------------------------------------------
  // Page mutations
  // ------------------------------------------------------------------
  function flushFocusedPage() {
    // Sync the current editable's HTML back into the model before we re-render
    const el = state.focusedEditable;
    if (!el || !el.isConnected) return;
    const idx = parseInt(el.dataset.pageIdx, 10);
    if (!Number.isNaN(idx)) state.currentDoc.pages[idx] = el.innerHTML;
  }

  // True when the caret is at the very start of the page editable (no text
  //  before it, ignoring empty inline wrappers).
  function isCaretAtStartOfPage(editable) {
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    if (!editable.contains(range.startContainer)) return false;
    const probe = document.createRange();
    probe.setStart(editable, 0);
    probe.setEnd(range.startContainer, range.startOffset);
    return probe.toString().length === 0;
  }

  // Backspace at start of page → merge this page into the previous one.
  function mergePageWithPrevious() {
    const editable = state.focusedEditable;
    if (!editable || !editable.isConnected) return false;
    const idx = parseInt(editable.dataset.pageIdx, 10);
    if (Number.isNaN(idx) || idx === 0) return false;

    pushStructUndo();
    flushFocusedPage();

    const prevHtml = state.currentDoc.pages[idx - 1] || "";
    const curHtml = state.currentDoc.pages[idx] || "";

    // Marker pinpoints where the join happens — we place the caret there after re-render.
    const marker = '<span class="__merge-caret">​</span>';
    state.currentDoc.pages[idx - 1] = prevHtml + marker + curHtml;
    state.currentDoc.pages.splice(idx, 1);

    markDirty();
    render();

    requestAnimationFrame(() => {
      const target = paper.querySelector(
        `.page-content[data-page-idx="${idx - 1}"]`,
      );
      if (!target) return;
      const markerEl = target.querySelector(".__merge-caret");
      if (markerEl) {
        const r = document.createRange();
        r.setStartBefore(markerEl);
        r.collapse(true);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
        markerEl.remove();
        // Sync HTML back to the model now that the marker is gone
        state.currentDoc.pages[idx - 1] = target.innerHTML;
      }
      target.focus({ preventScroll: false });
    });

    return true;
  }

  function insertPageBreakAtCursor() {
    const editable = state.focusedEditable;
    if (!editable || !editable.isConnected) {
      toast("Click into a page first");
      return;
    }
    const pageIdx = parseInt(editable.dataset.pageIdx, 10);
    if (Number.isNaN(pageIdx)) return;

    pushStructUndo();
    flushFocusedPage();

    const sel = window.getSelection();
    if (sel.rangeCount && editable.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      const before = document.createRange();
      before.selectNodeContents(editable);
      before.setEnd(range.endContainer, range.endOffset);
      const after = document.createRange();
      after.selectNodeContents(editable);
      after.setStart(range.endContainer, range.endOffset);

      const wrap = (frag) => {
        const d = document.createElement("div");
        d.appendChild(frag);
        return d.innerHTML;
      };
      state.currentDoc.pages[pageIdx] =
        wrap(before.cloneContents()) || "<p><br></p>";
      state.currentDoc.pages.splice(
        pageIdx + 1,
        0,
        wrap(after.cloneContents()) || "<p><br></p>",
      );
    } else {
      // No selection — just append a blank page after this one
      state.currentDoc.pages.splice(pageIdx + 1, 0, "<p><br></p>");
    }
    markDirty();
    render();
    requestAnimationFrame(() => {
      const next = paper.querySelector(
        `.page-content[data-page-idx="${pageIdx + 1}"]`,
      );
      if (next) {
        next.focus();
        // Place caret at the start
        const r = document.createRange();
        r.selectNodeContents(next);
        r.collapse(true);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
    });
  }

  function insertHtmlAtCursor(html) {
    const editable = state.focusedEditable;
    if (!editable || !editable.isConnected) {
      toast("Click into a page first");
      return;
    }
    editable.focus();
    document.execCommand("insertHTML", false, html);
    const idx = parseInt(editable.dataset.pageIdx, 10);
    if (!Number.isNaN(idx)) state.currentDoc.pages[idx] = editable.innerHTML;
    markDirty();
  }

  function insertTwoColAtCursor() {
    insertHtmlAtCursor(
      '<table class="two-col"><tbody><tr><td>&#8203;</td><td>&#8203;</td></tr></tbody></table><p><br></p>',
    );
  }

  function deletePageAtCursor() {
    const editable = state.focusedEditable;
    if (!editable || !editable.isConnected) return;
    const idx = parseInt(editable.dataset.pageIdx, 10);
    if (Number.isNaN(idx)) return;
    if (state.currentDoc.pages.length <= 1) {
      toast("Can't delete the only page");
      return;
    }
    if (!confirm(`Delete page ${idx + 1}?`)) return;
    pushStructUndo();
    state.currentDoc.pages.splice(idx, 1);
    markDirty();
    render();
  }

  function execFormat(cmd, value = null) {
    const editable = state.focusedEditable;
    if (!editable || !editable.isConnected) {
      toast("Click into a page first");
      return;
    }
    editable.focus();
    document.execCommand(cmd, false, value);
    const idx = parseInt(editable.dataset.pageIdx, 10);
    if (!Number.isNaN(idx)) state.currentDoc.pages[idx] = editable.innerHTML;
    markDirty();
  }

  // ------------------------------------------------------------------
  // Font sizing (selection-based)
  // ------------------------------------------------------------------
  const FONT_LADDER = [11, 12, 13, 14, 15, 16, 18, 20, 24, 30, 36, 48, 60];

  function setFontSize(px) {
    const editable = state.focusedEditable;
    if (!editable || !editable.isConnected) {
      toast("Click into a page first");
      return;
    }
    const sel = window.getSelection();
    if (
      !sel.rangeCount ||
      sel.isCollapsed ||
      !editable.contains(sel.anchorNode)
    ) {
      toast("Select some text first, then choose a size");
      return;
    }
    editable.focus({ preventScroll: true });

    // Capture the selected HTML (preserves inline formatting like bold/italic)
    const range = sel.getRangeAt(0);
    const fragment = range.cloneContents();
    const tmp = document.createElement("div");
    tmp.appendChild(fragment);
    const selectedHTML = tmp.innerHTML;
    if (!selectedHTML) return;

    // Replace the selection via execCommand so undo/redo (Ctrl+Z / Ctrl+Y) works.
    const wrapped = `<span style="font-size:${px}px">${selectedHTML}</span>`;
    let ok = false;
    try {
      ok = document.execCommand("insertHTML", false, wrapped);
    } catch {}
    if (!ok) {
      // Fallback path for environments that refuse insertHTML
      const span = document.createElement("span");
      span.style.fontSize = px + "px";
      try {
        range.surroundContents(span);
      } catch {
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
      }
    }

    const idx = parseInt(editable.dataset.pageIdx, 10);
    if (!Number.isNaN(idx)) state.currentDoc.pages[idx] = editable.innerHTML;
    markDirty();
  }

  function currentSelectionFontSize() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let node = sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    if (!node) return null;
    const cs = window.getComputedStyle(node);
    return parseInt(cs.fontSize, 10) || null;
  }

  function stepFontSize(delta) {
    const editable = state.focusedEditable;
    if (!editable || !editable.isConnected) {
      toast("Click into a page first");
      return;
    }
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) {
      toast("Select some text first");
      return;
    }
    const current = currentSelectionFontSize() ?? 15;
    // Find the nearest ladder step, then move `delta` rungs
    let idx = FONT_LADDER.findIndex((s) => s >= current);
    if (idx === -1) idx = FONT_LADDER.length - 1;
    const next =
      FONT_LADDER[Math.max(0, Math.min(FONT_LADDER.length - 1, idx + delta))];
    setFontSize(next);
  }

  // ------------------------------------------------------------------
  // Sidebar rendering
  // ------------------------------------------------------------------
  function renderSidebar() {
    const tplList = $("#templateList");
    tplList.innerHTML = "";
    state.templates.forEach((t) => {
      const li = document.createElement("li");
      if (state.currentMode === "template" && state.currentId === t.id)
        li.classList.add("active");
      li.innerHTML = `<span class="dot"></span><span class="name"></span>`;
      li.querySelector(".name").textContent = t.name;
      li.addEventListener("click", () => openTemplate(t.id));

      // Only user-created templates can be deleted; built-ins are read-only.
      if (!t.builtin) {
        const actions = document.createElement("span");
        actions.className = "row-actions";
        const del = document.createElement("button");
        del.textContent = "✕";
        del.title = "Delete template";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          confirmDeleteTemplate(t.id);
        });
        actions.appendChild(del);
        li.appendChild(actions);
      }
      tplList.appendChild(li);
    });

    const drfList = $("#draftList");
    drfList.innerHTML = "";
    if (state.drafts.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No drafts yet — pick a template, then ＋";
      drfList.appendChild(li);
    } else {
      state.drafts.forEach((d) => {
        const li = document.createElement("li");
        if (state.currentMode === "draft" && state.currentId === d.id)
          li.classList.add("active");
        const tpl = state.templates.find((t) => t.id === d.templateId);
        li.innerHTML = `<span class="dot"></span><span class="name"></span><span class="meta"></span>`;
        li.querySelector(".name").textContent = d.name;
        li.querySelector(".meta").textContent = tpl
          ? tpl.name.split(" ")[0]
          : "—";
        li.addEventListener("click", () => openDraft(d.id));

        const actions = document.createElement("span");
        actions.className = "row-actions";
        const del = document.createElement("button");
        del.textContent = "✕";
        del.title = "Delete draft";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          confirmDeleteDraft(d.id);
        });
        actions.appendChild(del);
        li.appendChild(actions);

        drfList.appendChild(li);
      });
    }
  }

  // ------------------------------------------------------------------
  // Opening templates / drafts
  // ------------------------------------------------------------------
  function openTemplate(id) {
    try {
      const tpl = state.templates.find((t) => t.id === id);
      if (!tpl) return;
      state.currentMode = "template";
      state.currentId = id;
      state.currentDoc = clone(ensurePagesFormat(tpl));
      Store.saveLast("template", id);
      document.body.classList.remove("home-mode");
      afterOpen(
        `Template: ${tpl.name}`,
        "Edits here update the default for every new draft.",
      );
    } catch (err) {
      console.error("openTemplate failed:", err);
      showErrorBanner("Could not open template: " + (err.message || err));
      state.currentDoc = null;
      Home.show();
    }
  }
  function openDraft(id) {
    const d = state.drafts.find((x) => x.id === id);
    if (!d) return;
    state.currentMode = "draft";
    state.currentId = id;
    state.currentDoc = clone(ensurePagesFormat(d));
    Store.saveLast("draft", id);
    document.body.classList.remove("home-mode");
    const tpl = state.templates.find((t) => t.id === d.templateId);
    afterOpen(
      d.name,
      tpl
        ? `From: ${tpl.name} · updated ${fmtTime(d.updatedAt)}`
        : `Updated ${fmtTime(d.updatedAt)}`,
    );
  }
  function afterOpen(title, meta) {
    $("#docTitle").textContent = title;
    $("#docMeta").textContent = meta;
    renderSidebar();
    render();
    setSaved();
    // Set voice language from doc
    if (state.currentDoc?.language)
      $("#langSelect").value = state.currentDoc.language;
  }

  // ------------------------------------------------------------------
  // Save / persistence
  // ------------------------------------------------------------------
  let dirty = false;
  function markDirty() {
    dirty = true;
    const s = $("#autosaveStatus");
    s.textContent = "unsaved";
    s.classList.add("dirty");
  }
  function setSaved() {
    dirty = false;
    const s = $("#autosaveStatus");
    s.textContent = "saved";
    s.classList.remove("dirty");
  }
  function save() {
    if (!state.currentDoc) return;
    if (state.currentMode === "template") {
      const tpl = state.currentDoc;
      tpl.name =
        $("#docTitle").textContent.replace(/^Template:\s*/, "") || tpl.name;
      Store.saveTemplate(tpl);
      state.templates = Store.loadTemplates();
      toast("Template saved");
    } else {
      const d = state.currentDoc;
      d.name = $("#docTitle").textContent || d.name;
      d.updatedAt = Date.now();
      Store.saveDraft(d);
      state.drafts = Store.loadDrafts();
      toast("Draft saved");
    }
    setSaved();
    renderSidebar();
  }

  // autosave every 4s if dirty
  setInterval(() => {
    if (dirty) save();
  }, 4000);
  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      save();
    }
  });

  // ------------------------------------------------------------------
  // Drafts & templates lifecycle
  // ------------------------------------------------------------------
  function newDraftFromCurrentTemplate() {
    let tpl;
    if (state.currentMode === "template")
      tpl = state.templates.find((t) => t.id === state.currentId);
    else if (state.currentMode === "draft") {
      const d = state.drafts.find((x) => x.id === state.currentId);
      tpl = state.templates.find((t) => t.id === d?.templateId);
    } else {
      tpl = state.templates[0];
    }
    if (!tpl) {
      toast("Pick a template first");
      return;
    }

    askText(
      "New draft",
      "Draft name",
      `${tpl.name} — ${new Date().toLocaleDateString()}`,
      (name) => {
        if (!name) return;
        const d = {
          id: uid("d"),
          name,
          templateId: tpl.id,
          language: tpl.language,
          pages: clone(tpl.pages),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        Store.saveDraft(d);
        state.drafts = Store.loadDrafts();
        openDraft(d.id);
      },
    );
  }

  function newBlankTemplate() {
    askText("New template", "Template name", "Untitled Template", (name) => {
      if (!name) return;
      const safeName = escapeHtml(name);
      const tpl = {
        id: uid("tpl"),
        name,
        language: $("#langSelect").value || "en-IN",
        description: "",
        builtin: false,
        pages: [
          `<h1 style="text-align:center">${safeName}</h1>` +
            `<p>Start writing — click anywhere to edit, use the toolbar to format text. ` +
            `Press the Page button to split into a new page.</p>`,
        ],
      };
      Store.saveTemplate(tpl);
      state.templates = Store.loadTemplates();
      openTemplate(tpl.id);
    });
  }

  function confirmDeleteTemplate(id) {
    const t = state.templates.find((x) => x.id === id);
    if (!t) return;
    if (
      !confirm(
        `Delete template "${t.name}"?\nExisting drafts based on this template stay intact.`,
      )
    )
      return;
    Store.deleteTemplate(id);
    state.templates = Store.loadTemplates();
    if (state.currentMode === "template" && state.currentId === id) {
      state.currentDoc = null;
      state.currentId = null;
      $("#docTitle").textContent = "Untitled";
      $("#docMeta").textContent = "—";
    }
    renderSidebar();
    render();
  }

  function confirmDeleteDraft(id) {
    const d = state.drafts.find((x) => x.id === id);
    if (!d) return;
    if (!confirm(`Delete draft "${d.name}"? This cannot be undone.`)) return;
    Store.deleteDraft(id);
    state.drafts = Store.loadDrafts();
    if (state.currentMode === "draft" && state.currentId === id) {
      state.currentDoc = null;
      state.currentId = null;
      $("#docTitle").textContent = "Untitled";
      $("#docMeta").textContent = "—";
      render();
    }
    renderSidebar();
    if (document.body.classList.contains("home-mode")) Home.render();
    toast("Draft deleted");
  }

  function bulkDeleteDrafts(ids) {
    if (!ids.length) return;
    if (
      !confirm(
        `Delete ${ids.length} draft${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    )
      return false;
    const idSet = new Set(ids);
    ids.forEach((id) => Store.deleteDraft(id));
    state.drafts = Store.loadDrafts();
    if (state.currentMode === "draft" && idSet.has(state.currentId)) {
      state.currentDoc = null;
      state.currentId = null;
      $("#docTitle").textContent = "Untitled";
      $("#docMeta").textContent = "—";
      render();
    }
    renderSidebar();
    toast(`${ids.length} draft${ids.length === 1 ? "" : "s"} deleted`);
    return true;
  }

  function resetCurrentTemplate() {
    if (state.currentMode !== "template") {
      toast("Reset only applies to templates");
      return;
    }
    const builtin = _builtins.find((b) => b.id === state.currentId);
    if (!builtin) {
      toast("No default to reset to");
      return;
    }
    if (
      !confirm(
        "Reset this template to its built-in default? Your customisations to the template will be lost. Drafts are unaffected.",
      )
    )
      return;
    Store.resetBuiltinTemplate(state.currentId);
    state.templates = Store.loadTemplates();
    openTemplate(state.currentId);
    toast("Template reset to default");
  }

  function deleteCurrent() {
    if (!state.currentDoc) return;
    if (state.currentMode === "draft") {
      if (!confirm(`Delete draft "${state.currentDoc.name}"?`)) return;
      Store.deleteDraft(state.currentId);
      state.drafts = Store.loadDrafts();
      state.currentDoc = null;
      state.currentId = null;
      $("#docTitle").textContent = "Untitled";
      $("#docMeta").textContent = "—";
      renderSidebar();
      render();
    } else {
      confirmDeleteTemplate(state.currentId);
    }
  }

  // ------------------------------------------------------------------
  // Export / Import
  // ------------------------------------------------------------------
  function exportCurrent() {
    if (!state.currentDoc) return;
    const data = clone(state.currentDoc);
    const fname =
      (data.name || "agreement")
        .replace(/[^\w\-ऀ-ॿ\s]/g, "")
        .replace(/\s+/g, "_") + ".json";
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Exported " + fname);
  }

  function exportCanvasCurrent() {
    if (!state.currentDoc) return;
    flushFocusedPage();
    const buildExportStack = () => {
      const stack = document.createElement("div");
      stack.className = "paper-stack";
      $$(".paper", paper).forEach((pageEl) => {
        const clone = pageEl.cloneNode(true);
        clone.querySelectorAll(".page-label").forEach((el) => el.remove());
        clone.querySelectorAll(".page-content").forEach((el) => {
          el.removeAttribute("contenteditable");
          el.removeAttribute("spellcheck");
          el.removeAttribute("data-page-idx");
        });
        stack.appendChild(clone);
      });
      return stack;
    };
    const baseName =
      (state.currentDoc.name || "agreement")
        .replace(/[^\w\-\u0900-\u097F\s]/g, "")
        .trim()
        .replace(/\s+/g, "_") || "agreement";
    const downloadPdf = async () => {
      if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
        toast("PDF export library failed to load", 3200);
        return;
      }
      const stage = document.createElement("div");
      stage.style.cssText = [
        "position:fixed",
        "left:-10000px",
        "top:0",
        "padding:0",
        "background:#fff",
        "z-index:-1",
        "pointer-events:none",
      ].join(";");
      const exportStack = buildExportStack();
      stage.appendChild(exportStack);
      document.body.appendChild(stage);

      try {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        const pdf = new window.jspdf.jsPDF({
          unit: "mm",
          format: "a4",
          orientation: "portrait",
          compress: true,
        });
        const pageNodes = $$(".paper", exportStack);
        for (let i = 0; i < pageNodes.length; i++) {
          const pageNode = pageNodes[i];
          const rect = pageNode.getBoundingClientRect();
          const canvas = await window.html2canvas(pageNode, {
            scale: Math.max(2, window.devicePixelRatio || 1),
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
            width: Math.ceil(rect.width),
            height: Math.ceil(rect.height),
          });
          const imgData = canvas.toDataURL("image/png");
          const pageWidthMm = 210;
          const pageHeightMm = (canvas.height * pageWidthMm) / canvas.width;
          if (i > 0) pdf.addPage();
          pdf.addImage(
            imgData,
            "PNG",
            0,
            0,
            pageWidthMm,
            pageHeightMm,
            undefined,
            "FAST",
          );
        }
        pdf.save(`${baseName}.pdf`);
        toast("Downloaded PDF");
      } catch (err) {
        console.error("PDF export failed", err);
        toast("PDF download failed", 3200);
      } finally {
        stage.remove();
      }
    };
    const modal = $("#modal");
    modal.classList.remove("hidden");
    modal.classList.add("pdf-preview-open");
    modal.tabIndex = -1;
    $("#modalTitle").textContent = "Preview PDF";
    $("#modalBody").innerHTML = `
      <p class="pdf-preview-note">Review the canvas below. Click Download PDF to continue.</p>
      <div id="pdfPreviewSurface" class="pdf-preview-surface"></div>
    `;
    $("#pdfPreviewSurface").appendChild(buildExportStack());
    const confirm = $("#modalConfirm");
    confirm.textContent = "Download PDF";
    const cleanup = () => {
      modal.classList.remove("pdf-preview-open");
      confirm.textContent = "OK";
      confirm.disabled = false;
      closeModal();
    };
    confirm.onclick = async () => {
      confirm.disabled = true;
      confirm.textContent = "Preparing...";
      try {
        await downloadPdf();
      } finally {
        cleanup();
      }
    };
    $$("[data-modal-close]", modal).forEach((b) => (b.onclick = cleanup));
    modal.onkeydown = (e) => {
      if (e.key === "Escape") cleanup();
    };
    setTimeout(() => modal.focus(), 30);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data.pages) && !Array.isArray(data.blocks)) {
          throw new Error("Missing pages (or legacy blocks) array");
        }
        // Migrate legacy block-format imports on the fly
        ensurePagesFormat(data);
        // Treat anything with builtin:false or a templateId field appropriately.
        // We import as a new template by default.
        const isDraft = !!data.templateId;
        if (isDraft) {
          data.id = uid("d");
          data.createdAt = data.createdAt || Date.now();
          data.updatedAt = Date.now();
          Store.saveDraft(data);
          state.drafts = Store.loadDrafts();
          openDraft(data.id);
        } else {
          data.id = uid("tpl");
          data.builtin = false;
          Store.saveTemplate(data);
          state.templates = Store.loadTemplates();
          openTemplate(data.id);
        }
        toast("Imported " + (data.name || "file"));
      } catch (err) {
        toast("Import failed: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  // ------------------------------------------------------------------
  // Voice input — Web Speech API
  // ------------------------------------------------------------------
  function setupVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      $("#btnVoice").disabled = true;
      $("#btnVoice").title =
        "Voice not supported in this browser — use Chrome or Edge";
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = $("#langSelect").value;

    rec.onresult = (e) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
      }
      if (finalText) insertIntoFocused(polishDictation(finalText, rec.lang));
    };

    rec.onerror = (ev) => {
      console.warn("Speech error:", ev.error);
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        stopVoice();
        toast(
          "Microphone blocked — allow it for this site in your browser settings",
          4500,
        );
      } else if (ev.error === "no-speech" || ev.error === "aborted") {
        /* benign — engine will restart via onend */
      } else if (ev.error === "network") {
        toast("Voice: network error — check your connection", 3500);
      } else if (ev.error === "audio-capture") {
        stopVoice();
        toast("No microphone detected", 3500);
      } else {
        toast("Voice error: " + ev.error, 3000);
      }
    };

    rec.onend = () => {
      // Auto-restart if the user hasn't toggled off. Tiny delay avoids races
      // where Chrome's engine isn't ready to restart immediately.
      if (state.voice.active) {
        setTimeout(() => {
          if (!state.voice.active) return;
          try {
            rec.start();
          } catch (err) {
            // If start fails (e.g. already started), wait a tick and try once more
            setTimeout(() => {
              if (state.voice.active) {
                try {
                  rec.start();
                } catch {}
              }
            }, 250);
          }
        }, 80);
      } else {
        $("#btnVoice").classList.remove("recording");
      }
    };
    state.voice.recognition = rec;
  }

  // ----- Light post-processing of dictated phrases -----
  function polishDictation(text, lang) {
    let t = String(text).trim();
    if (!t) return "";
    // Auto-capitalize first letter for Latin-script languages (Hindi etc. skip)
    const isLatin = /^(en|fr|de|es|it|pt|nl|sv|da|no)/i.test(lang || "");
    if (isLatin) t = t.charAt(0).toUpperCase() + t.slice(1);
    return t;
  }

  function startVoice() {
    const rec = state.voice.recognition;
    if (!rec) {
      toast("Voice not supported — use Chrome or Edge");
      return;
    }
    // Make sure a page is focused before we kick off (otherwise nothing to type into)
    if (!state.focusedEditable || !state.focusedEditable.isConnected) {
      const first = paper.querySelector('[contenteditable="true"]');
      if (first) first.focus();
      else {
        toast("Click into a page first");
        return;
      }
    }
    rec.lang = $("#langSelect").value;
    state.voice.active = true;
    try {
      rec.start();
    } catch (err) {
      // Already started — recover quietly
      try {
        rec.stop();
      } catch {}
      setTimeout(() => {
        try {
          rec.start();
        } catch {}
      }, 200);
    }
    $("#btnVoice").classList.add("recording");
  }

  function stopVoice() {
    state.voice.active = false;
    const rec = state.voice.recognition;
    if (rec) {
      try {
        rec.stop();
      } catch {}
    }
    $("#btnVoice").classList.remove("recording");
  }

  function toggleVoice() {
    if (state.voice.active) stopVoice();
    else startVoice();
  }

  function insertIntoFocused(text) {
    const el = state.focusedEditable;
    if (!el || !el.isConnected) {
      toast("Click into a page to dictate");
      return;
    }

    // Restore focus (and caret) if it drifted away — without forcing a scroll
    if (document.activeElement !== el) {
      el.focus({ preventScroll: true });
    }
    const sel = window.getSelection();
    // If there's no caret inside the editable, drop one at the end so insertion lands somewhere sensible
    if (!sel.rangeCount || !el.contains(sel.anchorNode)) {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }

    // If the caret somehow landed inside a non-editable .num prefix (legacy
    // numbered paragraphs), bounce it just after the span so dictated text
    // flows into the main body, not into the tiny number cell.
    let anchorEl = sel.anchorNode;
    if (anchorEl && anchorEl.nodeType === 3) anchorEl = anchorEl.parentElement;
    const numSpan = anchorEl && anchorEl.closest && anchorEl.closest(".num");
    if (numSpan) {
      const r = document.createRange();
      r.setStartAfter(numSpan);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }

    // Look at the character immediately before the caret to decide on spacing
    const range = sel.getRangeAt(0);
    let beforeChar = "";
    if (range.startContainer.nodeType === 3 && range.startOffset > 0) {
      beforeChar = range.startContainer.textContent.charAt(
        range.startOffset - 1,
      );
    } else if (range.startContainer.nodeType === 1 && range.startOffset > 0) {
      const prev = range.startContainer.childNodes[range.startOffset - 1];
      if (prev) beforeChar = (prev.textContent || "").slice(-1);
    }
    const needSpace = beforeChar && !/\s/.test(beforeChar) && !/^\s/.test(text);
    const finalText = needSpace ? " " + text : text;

    // execCommand('insertText') is the friendliest way to insert into contenteditable:
    // it respects undo/redo, fires the input event, and behaves correctly inside lists/tables.
    let ok = false;
    try {
      ok = document.execCommand("insertText", false, finalText);
    } catch {}
    if (!ok) {
      // Fallback: manual node insertion (older browsers / odd contexts)
      range.deleteContents();
      const node = document.createTextNode(finalText);
      range.insertNode(node);
      range.setStartAfter(node);
      range.setEndAfter(node);
      sel.removeAllRanges();
      sel.addRange(range);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // ------------------------------------------------------------------
  // Modal helpers
  // ------------------------------------------------------------------
  function askText(title, label, defaultValue, onOk) {
    const modal = $("#modal");
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML =
      `<label>${label}</label><input id="modalInput" />`;
    const input = $("#modalInput");
    input.value = defaultValue || "";
    modal.classList.remove("hidden");
    setTimeout(() => {
      input.focus();
      input.select();
    }, 30);

    const confirm = $("#modalConfirm");
    confirm.textContent = "OK";
    const closeAll = () => {
      closeModal();
      input.onkeydown = null;
    };
    confirm.onclick = () => {
      const v = input.value.trim();
      closeAll();
      onOk(v);
    };
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirm.click();
      }
      if (e.key === "Escape") closeAll();
    };
    $$("[data-modal-close]", modal).forEach((b) => (b.onclick = closeAll));
  }

  // ------------------------------------------------------------------
  // Home / landing view
  // ------------------------------------------------------------------
  const Home = {
    filter: "All",
    query: "",
    selectMode: false,
    selected: new Set(),
    draftsPage: 0,
    DRAFTS_PER_PAGE: 8,

    show() {
      // Stop any active dictation — the editor isn't visible from here
      if (state.voice && state.voice.active) stopVoice();
      document.body.classList.add("home-mode");
      Store.saveLast("home", null);
      this.render();
    },
    hide() {
      document.body.classList.remove("home-mode");
      this.selectMode = false;
      this.selected.clear();
    },

    render() {
      this.renderFilters();
      this.renderGrid();
      this.renderDrafts();
    },

    categories() {
      const cats = new Set(["All"]);
      state.templates.forEach((t) => {
        if (t.category) cats.add(t.category);
      });
      return Array.from(cats);
    },

    renderFilters() {
      const wrap = $("#homeFilters");
      wrap.innerHTML = "";
      const counts = {};
      state.templates.forEach((t) => {
        counts[t.category || "Uncategorized"] =
          (counts[t.category || "Uncategorized"] || 0) + 1;
      });
      this.categories().forEach((cat) => {
        const b = document.createElement("button");
        b.className = "home-filter" + (cat === this.filter ? " active" : "");
        const label = document.createElement("span");
        label.textContent = cat;
        const count = document.createElement("span");
        count.className = "home-filter-count";
        count.textContent =
          cat === "All" ? state.templates.length : counts[cat] || 0;
        b.appendChild(label);
        b.appendChild(count);
        b.addEventListener("click", () => {
          this.filter = cat;
          this.renderFilters();
          this.renderGrid();
        });
        wrap.appendChild(b);
      });
    },

    matchedTemplates() {
      const q = this.query.trim().toLowerCase();
      return state.templates.filter((t) => {
        if (this.filter !== "All" && t.category !== this.filter) return false;
        if (!q) return true;
        const hay = (
          t.name +
          " " +
          (t.description || "") +
          " " +
          (t.category || "")
        ).toLowerCase();
        return hay.includes(q);
      });
    },

    renderGrid() {
      const grid = $("#homeGrid");
      grid.innerHTML = "";
      const list = this.matchedTemplates();
      $("#homeCount").textContent =
        list.length + " template" + (list.length === 1 ? "" : "s");

      if (list.length === 0) {
        const empty = document.createElement("div");
        empty.className = "home-empty";
        empty.textContent = this.query
          ? `No agreements match "${this.query}".`
          : "No agreements available — import a JSON template from the editor.";
        grid.appendChild(empty);
        return;
      }

      list.forEach((t) => grid.appendChild(this.buildCard(t)));
    },

    buildCard(t) {
      const card = document.createElement("button");
      card.className = "home-card";
      card.type = "button";
      if (t.category) card.dataset.cat = t.category;

      const icon = document.createElement("div");
      icon.className = "home-card-icon";
      icon.textContent = t.icon || "📄";
      card.appendChild(icon);

      if (t.category) {
        const cat = document.createElement("span");
        cat.className = "home-card-cat";
        cat.textContent = t.category;
        card.appendChild(cat);
      }

      const name = document.createElement("div");
      name.className = "home-card-name";
      name.textContent = t.name;
      card.appendChild(name);

      const desc = document.createElement("p");
      desc.className = "home-card-desc";
      desc.textContent =
        t.description || "Start a new draft from this template.";
      card.appendChild(desc);

      const meta = document.createElement("div");
      meta.className = "home-card-meta";
      const pageCount = (t.pages || []).length || 1;
      meta.innerHTML = `<span>${pageCount} page${pageCount === 1 ? "" : "s"}</span><span class="dot"></span><span>A4 print-ready</span>`;
      card.appendChild(meta);

      const foot = document.createElement("div");
      foot.className = "home-card-foot";
      const action = document.createElement("span");
      action.innerHTML = 'Use template <span class="arrow">→</span>';
      const lang = document.createElement("span");
      lang.className = "lang-pill";
      lang.textContent = (t.language || "en-IN").toUpperCase();
      foot.appendChild(action);
      foot.appendChild(lang);
      card.appendChild(foot);

      card.addEventListener("click", () => this.startFromTemplate(t));
      return card;
    },

    startFromTemplate(t) {
      askText(
        "New draft",
        "Draft name",
        `${t.name} — ${new Date().toLocaleDateString()}`,
        (name) => {
          if (!name) return;
          const d = {
            id: uid("d"),
            name,
            templateId: t.id,
            language: t.language,
            pages: clone(t.pages),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          Store.saveDraft(d);
          state.drafts = Store.loadDrafts();
          this.hide();
          renderSidebar();
          openDraft(d.id);
        },
      );
    },

    pageNumbersFor(current, total) {
      // Always include first, last, and the current ± 1. Ellipsis fills gaps.
      const pages = new Set([0, total - 1, current - 1, current, current + 1]);
      const result = [];
      let prev = -1;
      Array.from(pages)
        .filter((p) => p >= 0 && p < total)
        .sort((a, b) => a - b)
        .forEach((p) => {
          if (prev !== -1 && p - prev > 1) result.push("...");
          result.push(p);
          prev = p;
        });
      return result;
    },

    renderDrafts() {
      const section = $("#homeDraftsSection");
      const wrap = $("#homeDrafts");
      // Clear any pagination from a previous render before re-rendering
      section.querySelectorAll(".home-pagination").forEach((el) => el.remove());

      if (state.drafts.length === 0) {
        section.hidden = true;
        this.selectMode = false;
        this.selected.clear();
        this.draftsPage = 0;
        return;
      }
      section.hidden = false;

      // Drop any selected ids that no longer exist (e.g. after a bulk delete)
      this.selected = new Set(
        Array.from(this.selected).filter((id) =>
          state.drafts.find((d) => d.id === id),
        ),
      );

      // Clamp current page in case drafts were deleted from later pages
      const totalPages = Math.max(
        1,
        Math.ceil(state.drafts.length / this.DRAFTS_PER_PAGE),
      );
      if (this.draftsPage >= totalPages) this.draftsPage = totalPages - 1;
      if (this.draftsPage < 0) this.draftsPage = 0;

      // ----- Section head -----
      const head = section.querySelector(".home-section-head");
      head.innerHTML = "";

      const titleWrap = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = this.selectMode
        ? `${this.selected.size} selected`
        : "Your drafts";
      titleWrap.appendChild(title);
      const meta = document.createElement("span");
      meta.className = "home-section-meta";
      if (this.selectMode) {
        meta.textContent = "Click cards to toggle";
      } else {
        const total = state.drafts.length;
        meta.textContent = total === 1 ? "1 draft" : `${total} drafts`;
      }
      titleWrap.appendChild(meta);
      head.appendChild(titleWrap);

      const actions = document.createElement("div");
      actions.className = "home-section-actions";
      if (this.selectMode) {
        const allSelected = this.selected.size === state.drafts.length;
        const allBtn = document.createElement("button");
        allBtn.className = "home-section-btn";
        allBtn.textContent = allSelected ? "Unselect all" : "Select all";
        allBtn.addEventListener("click", () => {
          if (allSelected) this.selected.clear();
          else state.drafts.forEach((d) => this.selected.add(d.id));
          this.renderDrafts();
        });
        actions.appendChild(allBtn);

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "home-section-btn";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", () => {
          this.selectMode = false;
          this.selected.clear();
          this.renderDrafts();
        });
        actions.appendChild(cancelBtn);

        const delBtn = document.createElement("button");
        delBtn.className = "home-section-btn danger";
        delBtn.disabled = this.selected.size === 0;
        delBtn.textContent =
          this.selected.size > 0 ? `Delete ${this.selected.size}` : "Delete";
        delBtn.addEventListener("click", () => {
          const ids = Array.from(this.selected);
          if (bulkDeleteDrafts(ids)) {
            this.selectMode = false;
            this.selected.clear();
            this.renderDrafts();
          }
        });
        actions.appendChild(delBtn);
      } else {
        const selBtn = document.createElement("button");
        selBtn.className = "home-section-btn";
        selBtn.textContent = "Select";
        selBtn.addEventListener("click", () => {
          this.selectMode = true;
          this.renderDrafts();
        });
        actions.appendChild(selBtn);
      }
      head.appendChild(actions);

      // ----- Cards -----
      wrap.innerHTML = "";
      const start = this.draftsPage * this.DRAFTS_PER_PAGE;
      const drafts = state.drafts.slice(start, start + this.DRAFTS_PER_PAGE);

      drafts.forEach((d) => {
        const tpl = state.templates.find((t) => t.id === d.templateId);
        const card = document.createElement("div");
        card.className = "home-draft";
        if (this.selectMode) card.classList.add("selecting");
        if (this.selected.has(d.id)) card.classList.add("selected");

        if (this.selectMode) {
          const check = document.createElement("span");
          check.className = "home-draft-check";
          check.textContent = this.selected.has(d.id) ? "✓" : "";
          card.appendChild(check);
        }

        const body = document.createElement("div");
        body.className = "home-draft-body";
        const n = document.createElement("div");
        n.className = "home-draft-name";
        n.textContent = d.name;
        const m = document.createElement("div");
        m.className = "home-draft-meta";
        m.textContent =
          (tpl ? tpl.name.split(" ")[0] + " · " : "") +
          "updated " +
          fmtTime(d.updatedAt);
        body.appendChild(n);
        body.appendChild(m);
        card.appendChild(body);

        if (!this.selectMode) {
          const delBtn = document.createElement("button");
          delBtn.className = "home-draft-del";
          delBtn.title = "Delete draft";
          delBtn.textContent = "✕";
          delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            confirmDeleteDraft(d.id);
          });
          card.appendChild(delBtn);
        }

        card.addEventListener("click", () => {
          if (this.selectMode) {
            if (this.selected.has(d.id)) this.selected.delete(d.id);
            else this.selected.add(d.id);
            this.renderDrafts();
          } else {
            this.hide();
            openDraft(d.id);
          }
        });
        wrap.appendChild(card);
      });

      // ----- Pagination -----
      if (totalPages > 1) {
        const pag = document.createElement("div");
        pag.className = "home-pagination";

        const mkBtn = (label, title, page, opts = {}) => {
          const b = document.createElement("button");
          b.className = "home-pag-btn" + (opts.active ? " active" : "");
          b.textContent = label;
          if (title) b.title = title;
          if (opts.disabled) b.disabled = true;
          else
            b.addEventListener("click", () => {
              this.draftsPage = page;
              this.renderDrafts();
              // Scroll the section into view so the user sees the new page from the top
              section.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          return b;
        };

        pag.appendChild(
          mkBtn("←", "Previous page", this.draftsPage - 1, {
            disabled: this.draftsPage === 0,
          }),
        );

        this.pageNumbersFor(this.draftsPage, totalPages).forEach((p) => {
          if (p === "...") {
            const e = document.createElement("span");
            e.className = "home-pag-ellipsis";
            e.textContent = "…";
            pag.appendChild(e);
          } else {
            pag.appendChild(
              mkBtn(String(p + 1), `Page ${p + 1}`, p, {
                active: p === this.draftsPage,
              }),
            );
          }
        });

        pag.appendChild(
          mkBtn("→", "Next page", this.draftsPage + 1, {
            disabled: this.draftsPage >= totalPages - 1,
          }),
        );

        section.appendChild(pag);
      }
    },
  };

  // ------------------------------------------------------------------
  // Wire up UI
  // ------------------------------------------------------------------
  function bindUI() {
    $("#btnSave").addEventListener("click", save);
    $("#btnExport").addEventListener("click", exportCanvasCurrent);
    $("#btnResetTemplate").addEventListener("click", resetCurrentTemplate);
    $("#btnDelete").addEventListener("click", deleteCurrent);
    $("#btnAddTemplate").addEventListener("click", newBlankTemplate);
    $("#btnNewDraft").addEventListener("click", newDraftFromCurrentTemplate);

    $("#fileImport").addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (f) importJSON(f);
      e.target.value = "";
    });

    // ---- Mobile sidebar drawer ----
    const isDrawerLayout = () =>
      window.matchMedia(`(max-width: ${TABLET_BP}px)`).matches;
    const closeSidebar = () => {
      document.body.classList.remove("sidebar-open");
      $("#sidebarBackdrop").hidden = true;
    };
    $("#btnSidebarToggle").addEventListener("click", () => {
      if (!isDrawerLayout()) return;
      const opening = !document.body.classList.contains("sidebar-open");
      document.body.classList.toggle("sidebar-open", opening);
      $("#sidebarBackdrop").hidden = !opening;
    });
    $("#sidebarBackdrop").addEventListener("click", closeSidebar);
    const syncResponsiveShell = () => {
      if (!isDrawerLayout()) {
        closeSidebar();
      } else {
        $("#sidebarBackdrop").hidden =
          !document.body.classList.contains("sidebar-open");
      }
    };
    window.addEventListener("resize", syncResponsiveShell);
    syncResponsiveShell();
    // Close after picking a template/draft on phone
    $("#sidebar").addEventListener("click", (e) => {
      if (e.target.closest(".side-list li")) {
        if (isDrawerLayout()) closeSidebar();
      }
    });

    // ---- Home navigation ----
    const goHome = () => console.log("GO HOME TRIGGERED"); Home.show();
    $("#btnHome").addEventListener("click", goHome);
    $("#brandHome").addEventListener("click", goHome);
    const homeSearch = $("#homeSearch");
    if (homeSearch && !homeSearch.hidden) {
      homeSearch.addEventListener("input", (e) => {
        Home.query = e.target.value;
        Home.renderGrid();
      });
    }

    $("#docTitle").addEventListener("input", markDirty);
    $("#docTitle").addEventListener("blur", save);

    // Formatting commands (Bold/Italic/Underline/Align/Lists) — run execCommand
    $$("#toolbar .tool[data-cmd]").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep editor focus
      btn.addEventListener("click", () => {
        if (!state.currentDoc) {
          toast("Open a template or draft first");
          return;
        }
        execFormat(btn.dataset.cmd);
      });
    });

    // Structural insertions (two-col, page break, delete page) + font size +/-
    $$("#toolbar .tool[data-action]").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => e.preventDefault());
      btn.addEventListener("click", () => {
        if (!state.currentDoc) {
          toast("Open a template or draft first");
          return;
        }
        const action = btn.dataset.action;
        if (action === "insert-2col") insertTwoColAtCursor();
        if (action === "page-break") insertPageBreakAtCursor();
        if (action === "delete-page") deletePageAtCursor();
        if (action === "font-bigger") stepFontSize(+1);
        if (action === "font-smaller") stepFontSize(-1);
      });
    });

    // Font-size dropdown — pick a preset, apply to selection.
    // Clicking the <select> steals focus from the editor, so we snapshot the
    // selection range on mousedown and restore it before applying the size.
    const fontSizeSel = $("#fontSize");
    if (fontSizeSel) {
      let savedRange = null;
      fontSizeSel.addEventListener("mousedown", () => {
        const sel = window.getSelection();
        if (
          sel.rangeCount &&
          state.focusedEditable &&
          state.focusedEditable.contains(sel.anchorNode)
        ) {
          savedRange = sel.getRangeAt(0).cloneRange();
        } else {
          savedRange = null;
        }
      });
      fontSizeSel.addEventListener("change", (e) => {
        const px = parseInt(e.target.value, 10);
        e.target.value = "";
        if (!px) return;
        if (savedRange && state.focusedEditable) {
          state.focusedEditable.focus({ preventScroll: true });
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(savedRange);
        }
        setFontSize(px);
        savedRange = null;
      });
    }

    $("#langSelect").addEventListener("change", () => {
      const lang = $("#langSelect").value;
      if (state.voice.recognition) {
        state.voice.recognition.lang = lang;
        // If actively listening, recycle the engine so the new language takes effect
        if (state.voice.active) {
          try {
            state.voice.recognition.stop();
          } catch {}
          // onend will auto-restart with the new lang
        }
      }
      if (state.currentDoc) {
        state.currentDoc.language = lang;
        markDirty();
      }
    });

    // Voice button — `mousedown.preventDefault` keeps the editor's caret put
    // (otherwise clicking the button would steal focus and lose the cursor)
    const btnVoice = $("#btnVoice");
    btnVoice.addEventListener("mousedown", (e) => e.preventDefault());
    btnVoice.addEventListener("click", toggleVoice);

    // Keyboard
    document.addEventListener("keydown", (e) => {
      // Ctrl+Z — prefer custom undo for structural ops (page break, delete page).
      // If our struct stack is empty, fall through and let the browser handle
      // its native contenteditable undo (for typing, bold, font-size, etc.).
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "z"
      ) {
        if (structUndoStack.length > 0 && state.currentDoc) {
          e.preventDefault();
          tryStructUndo();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newDraftFromCurrentTemplate();
      }
      // While the home view is showing, "/" jumps focus into the search input —
      // unless the user is already typing in a field.
      if (e.key === "/" && document.body.classList.contains("home-mode")) {
        const tag = (e.target.tagName || "").toLowerCase();
        const editable = e.target.isContentEditable;
        if (tag !== "input" && tag !== "textarea" && !editable) {
          const s = $("#homeSearch");
          if (s && !s.hidden) {
            e.preventDefault();
            s.focus();
            s.select();
          }
        }
      }
    });
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  async function init() {
    try {
      try {
        await loadBuiltins();
      } catch (err) {
        console.error("Could not load templates:", err);
        showErrorBanner(
          "Could not load templates: " +
            (err.message || err) +
            " — check that /templates/manifest.json and the listed JSON files are deployed.",
        );
      }
      state.templates = Store.loadTemplates();
      state.drafts = Store.loadDrafts();
      // Make Enter create <p> inside contenteditable (instead of <div>) across the app
      try {
        document.execCommand("defaultParagraphSeparator", false, "p");
      } catch {}
      bindUI();
      setupVoice();
      renderSidebar();

      // Restore the last-viewed document if there was one, otherwise show home.
      const last = Store.loadLast();
      if (
        last &&
        last.view === "draft" &&
        state.drafts.find((d) => d.id === last.id)
      ) {
        openDraft(last.id);
      } else if (
        last &&
        last.view === "template" &&
        state.templates.find((t) => t.id === last.id)
      ) {
        openTemplate(last.id);
      } else {
        Home.show();
      }
    } catch (err) {
      console.error("init() crashed:", err);
      showErrorBanner(
        "Startup crashed: " +
          (err.message || err) +
          (err.stack ? "\n" + err.stack : ""),
      );
    } finally {
      // Always unhide the body, even if init crashed — otherwise the user sees a
      // permanently blank page from `body.loading { visibility: hidden }`.
      document.body.classList.remove("loading");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
