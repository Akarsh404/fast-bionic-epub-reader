let book = null;
let rendition = null;
let currentSelectionCfi = null;
let bookTitle = "default_book";
let bionicEnabled = true;
let fontSize = 100; // in percent
let activeTheme = "sepia";

// Initialize Lucide Icons
lucide.createIcons();

// Elements
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const uploadContainer = document.getElementById("upload-container");
const readerContainer = document.getElementById("reader-container");
const errorMessage = document.getElementById("error-message");
const errorText = document.getElementById("error-text");
const loader = document.getElementById("loader");

const btnClose = document.getElementById("btn-close");
const bookTitleEl = document.getElementById("book-title");
const chapterTitleEl = document.getElementById("chapter-title");

const btnToggleBionic = document.getElementById("btn-toggle-bionic");
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

/* Drag and Drop Handlers */
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
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

dropZone.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

function showError(msg) {
  errorText.textContent = msg;
  errorMessage.classList.remove("hidden");
  loader.classList.add("hidden");
}

function showLoader() {
  errorMessage.classList.add("hidden");
  loader.classList.remove("hidden");
}

function handleFile(file) {
  if (!file.name.endsWith(".epub")) {
    showError("Invalid file format. Please upload an .epub file.");
    return;
  }

  showLoader();

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      loadBook(e.target.result);
    } catch (err) {
      showError("Error loading book: " + err.message);
    }
  };
  reader.onerror = function () {
    showError("Failed to read the file.");
  };
  reader.readAsArrayBuffer(file);
}

/* EPUB Reader Initialization & Layout */
function loadBook(bookData) {
  if (book) {
    book.destroy();
  }

  book = ePub(bookData);
  
  book.ready.then(() => {
    bookTitle = book.package.metadata.title || "Untitled Book";
    bookTitleEl.textContent = bookTitle;
  });

  // Render options
  rendition = book.renderTo("viewer", {
    width: "100%",
    height: "100%",
    flow: "paginated",
    spread: "none"
  });

  // Setup hooks to apply custom typography rules & Bionic formatting
  rendition.hooks.content.register(function (contents) {
    try {
      const doc = contents.document;
      
      // Inject Custom Highlighting & Font Rules inside iframe
      contents.addStylesheetRules({
        "body": {
          "font-family": "'Lora', Georgia, serif !important",
          "line-height": "1.7 !important",
          "padding": "0 20px"
        },
        "b": {
          "font-weight": "700 !important",
          "color": "var(--text-bold)"
        },
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
          "text-decoration-color": "var(--accent-color) !important",
          "text-decoration-thickness": "2px !important",
          "cursor": "pointer !important"
        }
      });

      if (bionicEnabled) {
        applyBionic(doc.body);
      }
    } catch (e) {
      console.error("Hook rendering error:", e);
      showError("Error applying book styles: " + e.message);
    }
  });

  // Display the book
  rendition.display().then(() => {
    uploadContainer.classList.add("hidden");
    readerContainer.classList.remove("hidden");
    loader.classList.add("hidden");
    applyTheme(activeTheme);
  }).catch(err => {
    showError("Could not render book: " + err.message);
  });

  // Register section changes (update chapter titles and progress)
  rendition.on("rendered", (section) => {
    const currentSection = book.navigation.get(section.href);
    if (currentSection) {
      chapterTitleEl.textContent = currentSection.label.trim();
    } else {
      chapterTitleEl.textContent = `Section ${section.index + 1}`;
    }
    
    restoreHighlights();
  });

  rendition.on("relocated", (location) => {
    updateProgress(location);
  });

  // Selection events
  rendition.on("selected", (cfiRange, contents) => {
    currentSelectionCfi = cfiRange;
    
    // Position toolbar
    const selection = contents.window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const iframeRect = contents.container.getBoundingClientRect();
      
      const top = rect.top + iframeRect.top - 48;
      const left = rect.left + iframeRect.left + (rect.width / 2) - 80;
      
      highlightToolbar.style.top = `${Math.max(10, top)}px`;
      highlightToolbar.style.left = `${Math.max(10, left)}px`;
      highlightToolbar.classList.remove("hidden");
    }
  });

  // Clear selection toolbar on click elsewhere
  document.addEventListener("mousedown", (e) => {
    if (!highlightToolbar.contains(e.target) && !e.target.closest("#viewer")) {
      highlightToolbar.classList.add("hidden");
    }
  });
}

/* Recursive Bionic Parser */
const bionicRegex = /([a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]+)/g;

function escapeHTML(str) {
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
}

function applyBionic(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue;
    if (!text || text.trim() === "") return;

    const escapedText = escapeHTML(text);
    const newHtml = escapedText.replace(bionicRegex, (match) => {
      const len = match.length;
      const fixation = Math.ceil(len * 0.4);
      return `<b>${match.slice(0, fixation)}</b>${match.slice(fixation)}`;
    });

    if (newHtml !== escapedText) {
      const template = node.ownerDocument.createElement("template");
      template.innerHTML = newHtml;
      node.parentNode.replaceChild(template.content, node);
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const tag = node.tagName.toLowerCase();
    // Ignore interactive/formatting elements that shouldn't receive bionic format
    if (
      tag !== "script" &&
      tag !== "style" &&
      tag !== "svg" &&
      tag !== "noscript" &&
      tag !== "code" &&
      tag !== "pre" &&
      tag !== "mark" &&
      tag !== "b"
    ) {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        applyBionic(child);
      }
    }
  }
}

/* Progress indicator updates */
function updateProgress(location) {
  if (!book || !rendition) return;

  const startCfi = location.start.cfi;
  const endCfi = location.end.cfi;
  
  // Progress estimation
  const percentage = book.locations.percentageFromCfi ? Math.round(book.locations.percentageFromCfi(startCfi) * 100) : 0;
  
  progressBar.style.width = `${percentage}%`;
  
  if (location.start.displayed && location.start.displayed.page) {
    const currentPage = location.start.displayed.page;
    const totalPages = location.start.displayed.total;
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages} (${percentage}%)`;
  } else {
    pageIndicator.textContent = `${percentage}% Read`;
  }
}

/* Annotation and Highlight Caching */
function getStorageKey() {
  return `highlights_${bookTitle.replace(/\s+/g, "_")}`;
}

function restoreHighlights() {
  if (!rendition) return;
  const key = getStorageKey();
  const saved = localStorage.getItem(key);
  if (saved) {
    const highlights = JSON.parse(saved);
    highlights.forEach(hl => {
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
  
  // Prevent duplicate CFI ranges
  highlights = highlights.filter(hl => hl.cfi !== currentSelectionCfi);
  highlights.push({ cfi: currentSelectionCfi, color: color });
  localStorage.setItem(key, JSON.stringify(highlights));

  rendition.annotations.add("highlight", currentSelectionCfi, {}, () => {
    removeHighlight(currentSelectionCfi);
  }, `epub-highlight-${color}`);

  // Clear current browser selection
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

// Highlight button clicks
document.querySelectorAll(".hl-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const color = btn.getAttribute("data-color");
    addHighlight(color);
  });
});

document.getElementById("btn-clear-hl").addEventListener("click", () => {
  if (currentSelectionCfi) {
    removeHighlight(currentSelectionCfi);
    highlightToolbar.classList.add("hidden");
  }
});

/* Settings Adjustments */
btnToggleBionic.addEventListener("click", () => {
  bionicEnabled = !bionicEnabled;
  if (bionicEnabled) {
    btnToggleBionic.classList.add("active");
  } else {
    btnToggleBionic.classList.remove("active");
  }
  
  // Reload rendition to apply/remove bionic styles
  if (rendition && rendition.location) {
    rendition.display(rendition.location.start.cfi);
  }
});

btnFontDecrease.addEventListener("click", () => {
  if (fontSize > 60) {
    fontSize -= 10;
    updateFontSetting();
  }
});

btnFontIncrease.addEventListener("click", () => {
  if (fontSize < 200) {
    fontSize += 10;
    updateFontSetting();
  }
});

function updateFontSetting() {
  fontSizeIndicator.textContent = `${fontSize}%`;
  if (rendition) {
    rendition.themes.fontSize(`${fontSize}%`);
  }
}

/* Theme Selector */
btnThemeDropdown.addEventListener("click", () => {
  themeMenu.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!btnThemeDropdown.contains(e.target) && !themeMenu.contains(e.target)) {
    themeMenu.classList.add("hidden");
  }
});

themeOptions.forEach(opt => {
  opt.addEventListener("click", () => {
    themeOptions.forEach(o => o.classList.remove("active"));
    opt.classList.add("active");
    
    const theme = opt.getAttribute("data-theme");
    applyTheme(theme);
    themeMenu.classList.add("hidden");
  });
});

function applyTheme(theme) {
  activeTheme = theme;
  document.body.className = `theme-${theme}`;

  if (rendition) {
    // Resolve theme variables to inject inside iframe
    let bg, color, boldColor;
    if (theme === "sepia") {
      bg = "#fcebe8";
      color = "#4f2d24";
      boldColor = "#2e150f";
    } else if (theme === "dark") {
      bg = "#121212";
      color = "#bbbbbb";
      boldColor = "#ffffff";
    } else {
      bg = "#ffffff";
      color = "#2c2c2c";
      boldColor = "#000000";
    }

    // Set inside iframe body via rendition overrides
    rendition.themes.override("background", bg);
    rendition.themes.override("color", color);
    
    // Re-register stylesheets variables so they render correctly
    const contents = rendition.getContents();
    if (contents && contents[0]) {
      contents[0].document.documentElement.style.setProperty("--text-bold", boldColor);
      contents[0].document.documentElement.style.setProperty("--accent-color", theme === "dark" ? "#e0b0ff" : "#a84632");
    }
  }
}

/* General Navigation */
btnPrev.addEventListener("click", () => {
  if (rendition) rendition.prev();
});

btnNext.addEventListener("click", () => {
  if (rendition) rendition.next();
});

// Arrow key navigation listener
document.addEventListener("keydown", (e) => {
  if (!rendition) return;
  if (e.key === "ArrowLeft") {
    rendition.prev();
  } else if (e.key === "ArrowRight") {
    rendition.next();
  }
});

// Go back to drop zone
btnClose.addEventListener("click", () => {
  if (book) {
    book.destroy();
    book = null;
    rendition = null;
  }
  uploadContainer.classList.remove("hidden");
  readerContainer.classList.add("hidden");
  highlightToolbar.classList.add("hidden");
});
