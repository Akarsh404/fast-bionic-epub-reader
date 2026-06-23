let book = null;
let rendition = null;
let currentSelectionCfi = null;
let bookTitle = "default_book";
let bionicEnabled = true;
let spreadEnabled = false;
let fontSize = 100;
let activeTheme = "sepia";

lucide.createIcons();

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const uploadContainer = document.getElementById("upload-container");
const readerContainer = document.getElementById("reader-container");
const errorMessage = document.getElementById("error-message");
const errorText = document.getElementById("error-text");
const loader = document.getElementById("loader");
const loaderText = loader.querySelector("p");

const btnClose = document.getElementById("btn-close");
const bookTitleEl = document.getElementById("book-title");
const chapterTitleEl = document.getElementById("chapter-title");

const btnToggleBionic = document.getElementById("btn-toggle-bionic");
const btnToggleSpread = document.getElementById("btn-toggle-spread");
const btnFontDecrease = document.getElementById("btn-font-decrease");
const btnFontIncrease = document.getElementById("btn-font-increase");
const fontSizeIndicator = document.getElementById("font-size-indicator");

const btnThemeDropdown = document.getElementById("btn-theme-dropdown");
const themeMenu = document.getElementById("theme-menu");
const themeOptions = document.querySelectorAll(".theme-option");

const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const progressBar = document.getElementById("progress-bar");
const pageIndicator = document.getElementById("page-indicator");

const highlightToolbar = document.getElementById("highlight-toolbar");
const viewerEl = document.getElementById("viewer");

const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;0,7..72,600;0,7..72,700;1,7..72,400&display=swap');";

const THEMES = {
  sepia: {
    body: { background: "#fcebe8 !important", color: "#4f2d24 !important" },
    "b": { color: "#2e150f !important" }
  },
  dark: {
    body: { background: "#121212 !important", color: "#bbbbbb !important" },
    "b": { color: "#ffffff !important" }
  },
  white: {
    body: { background: "#ffffff !important", color: "#2c2c2c !important" },
    "b": { color: "#000000 !important" }
  }
};

/* Drag and Drop */
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length > 0) handleFile(files[0]);
});

dropZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

function showError(msg) {
  errorText.textContent = msg;
  errorMessage.classList.remove("hidden");
  loader.classList.add("hidden");
}

function showLoader(msg) {
  errorMessage.classList.add("hidden");
  loader.classList.remove("hidden");
  if (msg) loaderText.textContent = msg;
}

function handleFile(file) {
  if (!file.name.endsWith(".epub")) {
    showError("Invalid file format. Please upload an .epub file.");
    return;
  }
  showLoader("Reading file...");
  const reader = new FileReader();
  reader.onload = (e) => {
    try { loadBook(e.target.result); }
    catch (err) { showError("Error loading book: " + err.message); }
  };
  reader.onerror = () => showError("Failed to read the file.");
  reader.readAsArrayBuffer(file);
}

/* Book Initialization */
function loadBook(bookData) {
  if (book) book.destroy();

  showLoader("Parsing EPUB structure...");

  book = ePub(bookData);

  book.ready.then(() => {
    bookTitle = book.package.metadata.title || "Untitled Book";
    bookTitleEl.textContent = bookTitle;
    showLoader("Rendering first page...");
  });

  rendition = book.renderTo("viewer", {
    width: "100%",
    height: "100%",
    flow: "paginated",
    spread: spreadEnabled ? "auto" : "none",
    minSpreadWidth: 950
  });

  // Register themes
  Object.keys(THEMES).forEach(name => {
    rendition.themes.register(name, THEMES[name]);
  });

  // Content hook: runs every time a new section loads in the iframe
  rendition.hooks.content.register(function (contents) {
    try {
      const doc = contents.document;
      const head = doc.head || doc.querySelector("head");

      // Inject Literata font into the iframe
      if (head && !doc.getElementById("bionic-font-import")) {
        const style = doc.createElement("style");
        style.id = "bionic-font-import";
        style.textContent = FONT_IMPORT;
        head.appendChild(style);
      }

      // Inject reading styles (synchronous — fast)
      contents.addStylesheetRules({
        "body": {
          "font-family": "'Literata', 'Charter', Georgia, serif !important",
          "line-height": "1.8 !important",
          "padding": "0 20px",
          "word-spacing": "0.05em"
        },
        "p, li, dd, dt, blockquote, td, th": {
          "font-family": "'Literata', 'Charter', Georgia, serif !important",
          "line-height": "1.8 !important"
        },
        "b": { "font-weight": "700 !important" },
        ".epub-highlight-yellow": {
          "background-color": "rgba(253, 224, 71, 0.45) !important",
          "cursor": "pointer !important"
        },
        ".epub-highlight-green": {
          "background-color": "rgba(134, 239, 172, 0.45) !important",
          "cursor": "pointer !important"
        },
        ".epub-highlight-pink": {
          "background-color": "rgba(244, 143, 177, 0.45) !important",
          "cursor": "pointer !important"
        },
        ".epub-highlight-underline": {
          "text-decoration": "underline !important",
          "text-decoration-thickness": "2px !important",
          "cursor": "pointer !important"
        }
      });

      // Apply theme colors (synchronous — fast)
      injectThemeColors(doc, activeTheme);

      // DEFER bionic processing so the page renders immediately
      // Without this, large chapters block rendition.display() from resolving
      if (bionicEnabled) {
        const body = doc.body;
        setTimeout(() => {
          applyBionic(body);
        }, 10);
      }
    } catch (e) {
      console.error("Hook rendering error:", e);
    }
  });

  // Loading timeout — show helpful message if stuck
  const loadTimeout = setTimeout(() => {
    if (uploadContainer.classList.contains("hidden")) return;
    showLoader("Still loading... large books take a moment");
  }, 8000);

  const failTimeout = setTimeout(() => {
    if (uploadContainer.classList.contains("hidden")) return;
    showError("This book is taking too long to load. It may be corrupted or use an unsupported format.");
  }, 45000);

  rendition.display().then(() => {
    clearTimeout(loadTimeout);
    clearTimeout(failTimeout);
    uploadContainer.classList.add("hidden");
    readerContainer.classList.remove("hidden");
    loader.classList.add("hidden");
    applyTheme(activeTheme);
  }).catch(err => {
    clearTimeout(loadTimeout);
    clearTimeout(failTimeout);
    showError("Could not render book: " + err.message);
  });

  rendition.on("rendered", (section) => {
    const currentSection = book.navigation.get(section.href);
    if (currentSection) {
      chapterTitleEl.textContent = currentSection.label.trim();
    } else {
      chapterTitleEl.textContent = `Section ${section.index + 1}`;
    }
    restoreHighlights();
  });

  rendition.on("relocated", (location) => updateProgress(location));

  rendition.on("selected", (cfiRange, contents) => {
    currentSelectionCfi = cfiRange;
    const selection = contents.window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const iframe = document.querySelector("#viewer iframe");
      const iframeRect = iframe ? iframe.getBoundingClientRect() : { top: 0, left: 0 };

      const top = rect.top + iframeRect.top - 48;
      const left = rect.left + iframeRect.left + (rect.width / 2) - 80;

      highlightToolbar.style.top = `${Math.max(10, top)}px`;
      highlightToolbar.style.left = `${Math.max(10, left)}px`;
      highlightToolbar.classList.remove("hidden");
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (!highlightToolbar.contains(e.target) && !e.target.closest("#viewer")) {
      highlightToolbar.classList.add("hidden");
    }
  });
}

/* Inject theme colors directly into iframe document */
function injectThemeColors(doc, theme) {
  let bg, color, boldColor;
  if (theme === "sepia") {
    bg = "#fcebe8"; color = "#4f2d24"; boldColor = "#2e150f";
  } else if (theme === "dark") {
    bg = "#121212"; color = "#bbbbbb"; boldColor = "#ffffff";
  } else {
    bg = "#ffffff"; color = "#2c2c2c"; boldColor = "#000000";
  }

  const styleId = "bionic-theme-override";
  let styleEl = doc.getElementById(styleId);
  if (!styleEl) {
    styleEl = doc.createElement("style");
    styleEl.id = styleId;
    (doc.head || doc.documentElement).appendChild(styleEl);
  }
  styleEl.textContent = `
    html, body { background: ${bg} !important; color: ${color} !important; }
    b { color: ${boldColor} !important; }
  `;
}

/* Bionic Reading — word-length-based fixation */
const bionicRegex = /([a-zA-Z\u00C0-\u024F\u1E00-\u1EFF']+)/g;

function getFixation(len) {
  if (len <= 1) return 1;
  if (len <= 2) return 2;
  if (len <= 3) return 2;
  if (len <= 5) return Math.ceil(len * 0.5);
  if (len <= 9) return Math.ceil(len * 0.4);
  return Math.ceil(len * 0.35);
}

function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function applyBionic(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue;
    if (!text || text.trim() === "") return;

    const escaped = escapeHTML(text);
    const newHtml = escaped.replace(bionicRegex, (match) => {
      const fixation = getFixation(match.length);
      return `<b>${match.slice(0, fixation)}</b>${match.slice(fixation)}`;
    });

    if (newHtml !== escaped) {
      const template = node.ownerDocument.createElement("template");
      template.innerHTML = newHtml;
      node.parentNode.replaceChild(template.content, node);
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const tag = node.tagName.toLowerCase();
    if (
      tag !== "script" && tag !== "style" && tag !== "svg" &&
      tag !== "noscript" && tag !== "code" && tag !== "pre" &&
      tag !== "mark" && tag !== "b" && tag !== "img"
    ) {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        applyBionic(child);
      }
    }
  }
}

/* Progress */
function updateProgress(location) {
  if (!book || !rendition) return;
  const startCfi = location.start.cfi;
  const percentage = book.locations.percentageFromCfi
    ? Math.round(book.locations.percentageFromCfi(startCfi) * 100) : 0;

  progressBar.style.width = `${percentage}%`;

  if (location.start.displayed && location.start.displayed.page) {
    const cp = location.start.displayed.page;
    const tp = location.start.displayed.total;
    pageIndicator.textContent = `Page ${cp} of ${tp} · ${percentage}%`;
  } else {
    pageIndicator.textContent = `${percentage}% Read`;
  }
}

/* Highlights */
function getStorageKey() {
  return `highlights_${bookTitle.replace(/\s+/g, "_")}`;
}

function restoreHighlights() {
  if (!rendition) return;
  const saved = localStorage.getItem(getStorageKey());
  if (saved) {
    JSON.parse(saved).forEach(hl => {
      rendition.annotations.add("highlight", hl.cfi, {}, () => {
        removeHighlight(hl.cfi);
      }, `epub-highlight-${hl.color}`);
    });
  }
}

function addHighlight(color) {
  if (!rendition || !currentSelectionCfi) return;
  const key = getStorageKey();
  let highlights = JSON.parse(localStorage.getItem(key) || "[]");
  highlights = highlights.filter(hl => hl.cfi !== currentSelectionCfi);
  highlights.push({ cfi: currentSelectionCfi, color: color });
  localStorage.setItem(key, JSON.stringify(highlights));

  rendition.annotations.add("highlight", currentSelectionCfi, {}, () => {
    removeHighlight(currentSelectionCfi);
  }, `epub-highlight-${color}`);

  const iframeContents = rendition.getContents();
  if (iframeContents && iframeContents[0]) {
    iframeContents[0].window.getSelection().removeAllRanges();
  }
  highlightToolbar.classList.add("hidden");
}

function removeHighlight(cfi) {
  if (!rendition) return;
  rendition.annotations.remove(cfi, "highlight");
  const key = getStorageKey();
  let highlights = JSON.parse(localStorage.getItem(key) || "[]");
  highlights = highlights.filter(hl => hl.cfi !== cfi);
  localStorage.setItem(key, JSON.stringify(highlights));
}

document.querySelectorAll(".hl-btn").forEach(btn => {
  btn.addEventListener("click", () => addHighlight(btn.getAttribute("data-color")));
});

document.getElementById("btn-clear-hl").addEventListener("click", () => {
  if (currentSelectionCfi) {
    removeHighlight(currentSelectionCfi);
    highlightToolbar.classList.add("hidden");
  }
});

/* Bionic Toggle */
btnToggleBionic.addEventListener("click", () => {
  bionicEnabled = !bionicEnabled;
  btnToggleBionic.classList.toggle("active", bionicEnabled);
  if (rendition && rendition.location) {
    rendition.display(rendition.location.start.cfi);
  }
});

/* Spread Toggle (Two-page view) */
btnToggleSpread.addEventListener("click", () => {
  spreadEnabled = !spreadEnabled;
  btnToggleSpread.classList.toggle("active", spreadEnabled);
  viewerEl.classList.toggle("spread-mode", spreadEnabled);

  if (rendition) {
    rendition.spread(spreadEnabled ? "auto" : "none");
    setTimeout(() => {
      rendition.resize();
    }, 100);
  }
});

/* Font Size */
btnFontDecrease.addEventListener("click", () => {
  if (fontSize > 60) { fontSize -= 10; updateFontSetting(); }
});

btnFontIncrease.addEventListener("click", () => {
  if (fontSize < 200) { fontSize += 10; updateFontSetting(); }
});

function updateFontSetting() {
  fontSizeIndicator.textContent = `${fontSize}%`;
  if (rendition) rendition.themes.fontSize(`${fontSize}%`);
}

/* Theme Selector */
btnThemeDropdown.addEventListener("click", (e) => {
  e.stopPropagation();
  themeMenu.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!btnThemeDropdown.contains(e.target) && !themeMenu.contains(e.target)) {
    themeMenu.classList.add("hidden");
  }
});

themeOptions.forEach(opt => {
  opt.addEventListener("click", (e) => {
    e.stopPropagation();
    themeOptions.forEach(o => o.classList.remove("active"));
    opt.classList.add("active");
    applyTheme(opt.getAttribute("data-theme"));
    themeMenu.classList.add("hidden");
  });
});

function applyTheme(theme) {
  activeTheme = theme;
  document.body.className = `theme-${theme}`;

  if (rendition) {
    rendition.themes.select(theme);

    const allContents = rendition.getContents();
    if (allContents) {
      allContents.forEach(c => {
        if (c && c.document) injectThemeColors(c.document, theme);
      });
    }
  }
}

/* Navigation */
btnPrev.addEventListener("click", () => { if (rendition) rendition.prev(); });
btnNext.addEventListener("click", () => { if (rendition) rendition.next(); });

document.addEventListener("keydown", (e) => {
  if (!rendition) return;
  if (e.key === "ArrowLeft") rendition.prev();
  else if (e.key === "ArrowRight") rendition.next();
});

btnClose.addEventListener("click", () => {
  if (book) { book.destroy(); book = null; rendition = null; }
  uploadContainer.classList.remove("hidden");
  readerContainer.classList.add("hidden");
  highlightToolbar.classList.add("hidden");
  viewerEl.classList.remove("spread-mode");
  spreadEnabled = false;
  btnToggleSpread.classList.remove("active");
});
