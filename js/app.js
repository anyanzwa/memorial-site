/* =====================================================================
   Everlight Memorials: app.js
   One file, split into small sections. Each page calls only what it needs.
   ===================================================================== */

/* ---------- 1. SMALL HELPERS ---------- */

// Shortcuts for finding elements
const $ = (selector) => document.querySelector(selector);

// Makes text safe to put inside HTML (stops people injecting code)
function safe(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// "Grace Wanjiku" -> "GW"
function initials(name) {
  return name.split(" ").slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

// Read and save simple data in the browser
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch (e) { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }   // happens when storage is full
}

// All obituaries = ones saved from the form + the sample ones
function allObituaries() {
  return load("saved_obituaries", []).concat(SAMPLE);
}

/* ---------- 1b. BIG FILES: the funeral program PDF is kept in IndexedDB ---------- */
// localStorage is only about 5 MB in total, too small for a 5 MB PDF.
// IndexedDB is the browser's storage for big files, so the PDF is kept there instead.
function openFiles() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("everlight", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveFile(key, file) {
  const db = await openFiles();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function loadFile(key) {
  const db = await openFiles();
  return new Promise((resolve, reject) => {
    const request = db.transaction("files").objectStore("files").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ---------- 2. OBITUARY CARD (used on home and list pages) ---------- */

function cardHTML(o) {
  const picture = o.photo ? `<img src="${safe(o.photo)}" alt="">` : initials(o.name);
  return `
    <a class="card" href="obituary.html?id=${encodeURIComponent(o.id)}">
      <div class="photo">${picture}</div>
      <div class="card-body">
        <h3>${safe(o.name)}</h3>
        <p class="small">${o.born} – ${o.died.slice(0, 4)} · Age ${o.age}</p>
        <p class="small summary">${safe(o.summary)}</p>
        <span class="meta">${safe(o.county)} County</span>
      </div>
    </a>`;
}

/* ---------- 2b. CARD EFFECTS (fade-in, 3D tilt, moving light) ---------- */

// Call this every time cards are put on the page: cardEffects(containerElement)
function cardEffects(container) {
  const cards = container.querySelectorAll(".card");

  // People who prefer less motion get no effects at all
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // EFFECT 1: fade in and slide up, one card after another, when scrolled into view
  let order = 0;   // counts cards in the same batch so they appear one by one
  const watcher = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      setTimeout(() => card.classList.remove("waiting"), order * 120);
      order++;
      watcher.unobserve(card);
    });
    setTimeout(() => { order = 0; }, 600);
  }, { threshold: 0.15 });

  cards.forEach((card) => {
    card.classList.add("waiting");
    watcher.observe(card);
  });

  // Tilt and light only make sense with a mouse (not on phones)
  if (!window.matchMedia("(hover: hover)").matches) return;

  cards.forEach((card) => {
    // EFFECT 2: the card tilts towards the mouse. EFFECT 3: light follows the mouse.
    card.addEventListener("mousemove", (event) => {
      const box = card.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;    // 0 (left) to 1 (right)
      const y = (event.clientY - box.top) / box.height;    // 0 (top) to 1 (bottom)
      card.style.setProperty("--ry", (x - 0.5) * 14 + "deg");
      card.style.setProperty("--rx", (0.5 - y) * 14 + "deg");
      card.style.setProperty("--mx", x * 100 + "%");
      card.style.setProperty("--my", y * 100 + "%");
    });
    // When the mouse leaves, the card settles back flat
    card.addEventListener("mouseleave", () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });
}

// Simple fade-in for any group of elements (used by the services section)
function revealOnScroll(elements) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let order = 0;
  const watcher = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const item = entry.target;
      setTimeout(() => item.classList.remove("waiting"), order * 120);
      order++;
      watcher.unobserve(item);
    });
    setTimeout(() => { order = 0; }, 600);
  }, { threshold: 0.15 });
  elements.forEach((item) => { item.classList.add("waiting"); watcher.observe(item); });
}

/* ---------- 3. SITE-WIDE: footer year and phone menu ---------- */

function setupSite() {
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  const button = $(".menu-button");
  const menu = $(".menu");
  button.addEventListener("click", () => menu.classList.toggle("open"));
}

/* ---------- 4. HOME PAGE: slideshow + recent obituaries ---------- */

function setupHome() {
  // Recent obituaries (first 4)
  $("#recent").innerHTML = allObituaries().slice(0, 4).map(cardHTML).join("");
  cardEffects($("#recent"));
  revealOnScroll(document.querySelectorAll(".service"));

  // Slideshow: show one slide at a time, change every 5 seconds
  const slides = document.querySelectorAll(".slide");
  const dots = document.querySelectorAll(".dots button");
  let current = 0;

  function showSlide(number) {
    slides[current].classList.remove("show");
    dots[current].classList.remove("show");
    current = number;
    slides[current].classList.add("show");
    dots[current].classList.add("show");
  }

  dots.forEach((dot, i) => dot.addEventListener("click", () => showSlide(i)));
  setInterval(() => showSlide((current + 1) % slides.length), 5000);
}

/* ---------- 5. OBITUARIES PAGE: search + county filter ---------- */

function setupList() {
  const list = $("#list");
  const search = $("#q");
  const county = $("#county");
  const all = allObituaries();

  // Fill the county dropdown with the counties that exist
  const counties = [...new Set(all.map((o) => o.county))].sort();
  counties.forEach((c) => county.add(new Option(c, c)));

  function show() {
    const word = search.value.trim().toLowerCase();
    const results = all.filter((o) =>
      (county.value === "" || o.county === county.value) &&
      (word === "" || o.name.toLowerCase().includes(word))
    );
    $("#count").textContent = results.length + " obituaries found";
    list.innerHTML = results.length
      ? results.map(cardHTML).join("")
      : '<p class="empty">No obituaries found. Try another name or county.</p>';
    cardEffects(list);   // add the nice effects to the new cards
  }

  search.addEventListener("input", show);
  county.addEventListener("change", show);
  $("#clear").addEventListener("click", () => { search.value = ""; county.value = ""; show(); });
  show();
}

/* ---------- 6. FORM CHECKING (used by both forms) ---------- */

// Checks each field. Returns true only if all are fine.
function checkFields(fields) {
  let ok = true;
  fields.forEach((field) => {
    const error = field.parentElement.querySelector(".error");
    let message = "";
    if (field.required && field.value.trim() === "") message = "This field is required.";
    else if (field.type === "email" && field.value && !/^\S+@\S+\.\S+$/.test(field.value)) message = "Enter a valid email.";
    else if (field.type === "tel" && field.value && !/^[+\d\s-]{9,15}$/.test(field.value)) message = "Enter a valid phone number.";
    error.textContent = message;
    field.classList.toggle("bad", message !== "");
    if (message) ok = false;
  });
  return ok;
}

/* ---------- 7. SUBMIT PAGE: form, PDF upload, live preview ---------- */

function setupSubmit() {
  const form = $("#submit-form");
  const get = (id) => $("#" + id);   // shortcut: get("name") finds #name

  // Update the preview card while typing
  function updatePreview() {
    const name = get("name").value.trim() || "Full name";
    const born = get("born").value.slice(0, 4) || "????";
    const died = get("died").value.slice(0, 4) || "????";
    $("#pv-init").textContent = initials(name);
    $("#pv-name").textContent = name;
    $("#pv-dates").textContent = born + " – " + died;
    $("#pv-story").textContent = get("story").value.slice(0, 120) || "A short life story will appear here.";
    $("#pv-county").textContent = (get("county").value || "County") + " County";

    // Show the chosen photo in the preview (or the initials if there is none)
    const file = get("photo").files[0];
    const hasPhoto = file && file.type.startsWith("image/");
    if (hasPhoto && $("#pv-img").dataset.file !== file.name + file.size) {
      $("#pv-img").src = URL.createObjectURL(file);
      $("#pv-img").dataset.file = file.name + file.size;
    }
    $("#pv-img").hidden = !hasPhoto;
    $("#pv-init").hidden = hasPhoto;
  }
  form.addEventListener("input", updatePreview);
  updatePreview();

  // Turn the chosen photo into a small picture we can store (or "" if none).
  // It is shrunk to 600 pixels so it does not fill up the browser storage.
  function readPhoto() {
    return new Promise((resolve, reject) => {
      const file = get("photo").files[0];
      if (!file) return resolve("");
      if (!file.type.startsWith("image/")) return reject("Please choose an image file (JPG or PNG).");
      if (file.size > 5 * 1024 * 1024) return reject("The photo must be smaller than 5 MB.");
      const reader = new FileReader();
      reader.onerror = () => reject("Could not read the photo.");
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject("Could not read the photo.");
        image.onload = () => {
          const scale = Math.min(1, 600 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Checks the chosen PDF (up to 5 MB). Gives back the file, or "" if none was chosen.
  function readPdf() {
    return new Promise((resolve, reject) => {
      const file = get("program").files[0];
      if (!file) return resolve("");
      if (file.type !== "application/pdf") return reject("Please choose a PDF file.");
      if (file.size > 5 * 1024 * 1024) return reject("The PDF must be smaller than 5 MB.");
      resolve(file);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();   // stop the page from reloading

    // 1. Check the required fields
    const required = ["name", "born", "died", "county", "story", "contact", "email"].map(get);
    if (!checkFields(required)) return;
    if (get("phone").value && !checkFields([get("phone")])) return;

    // 2. Read the photo and the PDF (if any)
    let photo = "";
    try { photo = await readPhoto(); get("photo").parentElement.querySelector(".error").textContent = ""; }
    catch (message) { get("photo").parentElement.querySelector(".error").textContent = message; return; }

    let program = "";
    try { program = await readPdf(); }
    catch (message) { get("program").parentElement.querySelector(".error").textContent = message; return; }

    // 3. Build the obituary
    const born = get("born").value.slice(0, 4);
    const died = get("died").value;
    const story = get("story").value.trim();
    const obituary = {
      id: get("name").value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now(),
      name: get("name").value.trim(), born: born, died: died, age: Number(died.slice(0, 4)) - Number(born),
      county: get("county").value, summary: story.slice(0, 110) + (story.length > 110 ? "…" : ""), story: story,
      service: get("service").value.trim(), burial: get("burial").value.trim(), photo: photo, program: program ? "idb" : "",
      mpesaNumber: get("mpesa-number").value.trim(), mpesaName: get("mpesa-name").value.trim(),
      bankName: get("bank-name").value.trim(), bankAccount: get("bank-account").value.trim(),
      bankHolder: get("bank-holder").value.trim(), contributionContact: get("contribution-contact").value.trim()
    };

    // 4. Save it and show a message
    const notice = $("#notice");
    if (program) {                                       // the PDF goes into IndexedDB
      try { await saveFile("program_" + obituary.id, program); }
      catch (e) {
        notice.textContent = "Could not save the PDF in this browser. Try again without the PDF.";
        notice.classList.add("show");
        return;
      }
    }
    const saved = load("saved_obituaries", []);
    saved.unshift(obituary);
    if (save("saved_obituaries", saved)) {
      notice.innerHTML = `✓ Obituary saved. <a href="obituary.html?id=${encodeURIComponent(obituary.id)}">View it here</a>.`;
      form.reset();
      updatePreview();
    } else {
      notice.textContent = "Could not save. The photo may be too large for this browser. Try a smaller photo.";
    }
    notice.classList.add("show");
    notice.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/* ---------- 7b. FUNERAL PROGRAM VIEWER (shows the PDF pages on the page itself) ---------- */
// Uses the free PDF.js library. It is loaded only on memorial pages that have a program.
const PDFJS_URL    = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const script = document.createElement("script");
    script.src = PDFJS_URL;
    script.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; resolve(pdfjsLib); };
    script.onerror = () => reject(new Error("PDF viewer could not load"));
    document.head.appendChild(script);
  });
}

// Gets the PDF bytes (for drawing) and a link (for downloading) for an obituary
async function getProgram(o) {
  if (o.program === "idb") {                               // uploaded by a family: stored as a file
    const file = await loadFile("program_" + o.id);
    if (!file) throw new Error("Program file not found");
    return { bytes: new Uint8Array(await file.arrayBuffer()), link: URL.createObjectURL(file) };
  }
  const raw = atob(o.program.split(",")[1]);               // built-in sample: stored as text
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return { bytes: bytes, link: o.program };
}

// Draws every page of the PDF, one under the other, inside the box with id="program-pages"
async function showProgram(o) {
  const box = $("#program-pages");
  try {
    const program = await getProgram(o);
    $("#program-download").href = program.link;            // the download button works even if drawing fails

    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: program.bytes }).promise;
    box.innerHTML = "";
    const width = box.clientWidth - 24;                    // room for the box padding

    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const size = page.getViewport({ scale: 1 });
      const scale = (width / size.width) * (window.devicePixelRatio || 1);   // sharp on phone screens
      const view = page.getViewport({ scale: scale });
      const canvas = document.createElement("canvas");
      canvas.width = view.width;
      canvas.height = view.height;
      box.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: view }).promise;
    }
  } catch (error) {
    box.innerHTML = '<p class="small center">The program could not be shown here. Please use the download button below.</p>';
  }
}

/* ---------- 8. SINGLE OBITUARY PAGE (written like a blog post about a person) ---------- */

function setupObituary() {
  const id = new URLSearchParams(location.search).get("id");
  const all = allObituaries();
  const o = all.find((item) => item.id === id);
  const page = $("#obituary");

  if (!o) {
    page.innerHTML = '<div class="container section center"><h1>Obituary not found</h1><p><a href="obituaries.html">← Back to all obituaries</a></p></div>';
    return;
  }
  document.title = o.name + " | Everlight Memorials";

  // ----- Prepare the pieces -----
  const paragraphs = o.story.split(/\n+/).filter(Boolean).map((text) => `<p>${safe(text)}</p>`).join("");
  const minutes = Math.max(1, Math.round(o.story.split(/\s+/).length / 200));
  const diedLong = new Date(o.died).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
  const others = all.filter((item) => item.id !== o.id).slice(0, 3);
  const portrait = o.photo ? `<img src="${safe(o.photo)}" alt="Photo of ${safe(o.name)}">` : initials(o.name);

  const details = (o.service || o.burial) ? `
      <h2 class="ornate">Funeral details</h2>
      <div class="details">
        ${o.service ? `<div class="detail"><b>Memorial service</b><p>${safe(o.service)}</p></div>` : ""}
        ${o.burial ? `<div class="detail"><b>Burial</b><p>${safe(o.burial)}</p></div>` : ""}
      </div>` : "";

  const program = o.program ? `
      <h2 class="ornate">Funeral program</h2>
      <p class="small center">Scroll to read the program here, or download it as a PDF.</p>
      <div class="program-viewer" id="program-pages"><p class="small center">Loading the program…</p></div>
      <p class="center" style="margin-top:14px"><a class="btn gold" id="program-download" href="#" download="funeral-program.pdf">⬇ Download the program (PDF)</a></p>` : "";

  const hasMpesa = o.mpesaNumber;
  const hasBank = o.bankName || o.bankAccount;
  const contribution = (hasMpesa || hasBank) ? `
      <div class="side-box">
        <h3>Contribute to the family</h3>
        ${hasMpesa ? `<p><b>M-Pesa</b><br>${safe(o.mpesaNumber)} ${o.mpesaName ? "<span class='small'>(" + safe(o.mpesaName) + ")</span>" : ""}</p>` : ""}
        ${hasBank ? `<p><b>Bank</b><br>${safe(o.bankName || "")} · ${safe(o.bankAccount || "")}<br><span class="small">${safe(o.bankHolder || "")}</span></p>` : ""}
        ${o.contributionContact ? `<p><b>Contact</b><br>${safe(o.contributionContact)}</p>` : ""}
      </div>` : "";

  // ----- Build the page -----
  page.innerHTML = `
    <header class="post-hero">
      <div class="post-hero-bg" id="hero-bg"></div>
      <div class="container">
        <p class="crumbs"><a href="index.html">Home</a> / <a href="obituaries.html">Obituaries</a></p>
        <p class="hero-top">In Loving Memory</p>
        <div class="portrait-ring">${portrait}</div>
        <h1>${safe(o.name)}</h1>
        <p class="hero-dates">
          <span>Sunrise<b>${o.born}</b></span><i>✦</i><span>Sunset<b>${o.died.slice(0, 4)}</b></span>
        </p>
        <p class="hero-epitaph">${safe(o.summary)}</p>
        <p class="post-meta">Age ${o.age} · ${safe(o.county)} County · ${minutes} min read</p>
        <p class="hero-candle"><button class="btn gold" id="candle">🕯️ Light a candle</button><span id="candle-count" class="small"></span></p>
      </div>
    </header>

    <section class="section">
      <div class="container post-layout">

        <article class="post">
          <h2 class="ornate" style="margin-top:0">Life story</h2>
          <div class="post-text">${paragraphs}</div>
          ${details}
          ${program}

          <h2 class="ornate" id="comments-title">Tributes</h2>
          <div id="tributes"></div>
          <div class="panel">
            <h3>Leave a tribute</h3>
            <form id="tribute-form" novalidate>
              <div><label for="t-name">Your name</label><input id="t-name" maxlength="60" required><div class="error"></div></div>
              <div><label for="t-msg">Your message</label><textarea id="t-msg" maxlength="600" required placeholder="Share a memory or a word of comfort"></textarea><div class="error"></div></div>
              <button class="btn gold" type="submit">Post tribute</button>
            </form>
          </div>
        </article>

        <aside class="post-side">
          <div class="side-box">
            <h3>Remembering</h3>
            <p class="facts-list"><span>Passed on</span> ${diedLong}</p>
            <p class="facts-list"><span>Age</span> ${o.age} years</p>
            <p class="facts-list"><span>Home county</span> ${safe(o.county)}</p>
          </div>
          ${contribution}
          <div class="side-box">
            <h3>Share this tribute</h3>
            <a class="btn outline share" id="whatsapp" target="_blank" rel="noopener">Share on WhatsApp</a>
            <button class="btn outline share" id="copy" type="button">Copy link</button>
          </div>
        </aside>

      </div>
    </section>

    ${others.length ? `
    <section class="section white">
      <div class="container">
        <h2 class="ornate" style="margin-top:0">Other lives remembered</h2>
        <div class="grid" id="others" style="margin-top:24px">${others.map(cardHTML).join("")}</div>
      </div>
    </section>` : ""}`;

  // ----- Funeral program: draw the PDF pages on the page -----
  if (o.program) showProgram(o);

  // ----- Hero background: the photo, softly blurred -----
  if (o.photo) $("#hero-bg").style.backgroundImage = 'url("' + o.photo + '")';

  // ----- Candles -----
  const candleKey = "candles_" + o.id;
  function showCandles() {
    const n = load(candleKey, 0);
    $("#candle-count").textContent = n ? n + " candle(s) lit in memory" : "Be the first to light a candle";
  }
  $("#candle").addEventListener("click", () => { save(candleKey, load(candleKey, 0) + 1); showCandles(); });
  showCandles();

  // ----- Share buttons -----
  $("#whatsapp").href = "https://wa.me/?text=" + encodeURIComponent("In loving memory of " + o.name + ": " + location.href);
  $("#copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); $("#copy").textContent = "Link copied ✓"; }
    catch (e) { $("#copy").textContent = "Copy the address from your browser"; }
  });

  // ----- Tributes (shown like blog comments) -----
  const tributeKey = "tributes_" + o.id;
  function showTributes() {
    const list = load(tributeKey, []);
    $("#comments-title").textContent = "Tributes (" + list.length + ")";
    $("#tributes").innerHTML = list.length
      ? list.map((t) => `
          <div class="comment">
            <div class="c-avatar">${initials(t.name)}</div>
            <div><b>${safe(t.name)}</b> <span class="small">· ${t.date}</span><p>${safe(t.message)}</p></div>
          </div>`).join("")
      : '<p class="small">No tributes yet. Be the first to share a memory.</p>';
  }
  $("#tribute-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#t-name");
    const message = $("#t-msg");
    if (!checkFields([name, message])) return;
    const list = load(tributeKey, []);
    list.unshift({ name: name.value.trim(), message: message.value.trim(), date: new Date().toLocaleDateString("en-KE") });
    save(tributeKey, list);
    name.value = "";
    message.value = "";
    showTributes();
  });
  showTributes();

  // ----- Nice effects on the "other lives" cards -----
  if ($("#others")) cardEffects($("#others"));
}

/* ---------- 9. START: run the right code for the current page ---------- */

document.addEventListener("DOMContentLoaded", () => {
  setupSite();
  const page = document.body.dataset.page;      // set in each HTML file: <body data-page="home">
  if (page === "home") setupHome();
  if (page === "list") setupList();
  if (page === "submit") setupSubmit();
  if (page === "obituary") setupObituary();
});