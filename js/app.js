/* =====================================================================
   Tribute Hub: app.js (Major Services Update - Google Auth & Paywalls)
   ===================================================================== */

/* ---------- 0. SUPABASE SETUP ---------- */
const SUPABASE_URL = "https://fbyudpgnftqsjdavonrk.supabase.co";
const SUPABASE_KEY = "sb_publishable_COCPqopEzt65pbU__UiKWQ_utlMyn7z";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------- 1. SMALL HELPERS ---------- */
const $ = (selector) => document.querySelector(selector);

function safe(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function initials(name) {
  if (!name) return "";
  return name.split(" ").slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

async function uploadFile(file, folder) {
  if (!file) return "";
  const fileExt = file.name ? file.name.split('.').pop() : 'png';
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  
  const { data, error } = await db.storage.from('memorial-assets').upload(fileName, file);
  if (error) { console.error("Upload error:", error); return ""; }
  const { data: publicURLData } = db.storage.from('memorial-assets').getPublicUrl(fileName);
  return publicURLData.publicUrl;
}

/* ---------- 2. OBITUARY CARD & EFFECTS ---------- */
function cardHTML(o) {
  const picture = o.photo_url ? `<img src="${safe(o.photo_url)}" alt="">` : initials(o.name);
  return `
    <a class="card" href="obituary.html?id=${encodeURIComponent(o.id)}">
      <div class="photo">${picture}</div>
      <div class="card-body">
        <h3>${safe(o.name)}</h3>
        <p class="small">${o.born} – ${o.died ? o.died.slice(0, 4) : '????'} · Age ${o.age}</p>
        <p class="small summary">${safe(o.summary)}</p>
        <span class="meta">${safe(o.county)} County</span>
      </div>
    </a>`;
}

function cardEffects(container) {
  const cards = container.querySelectorAll(".card");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let order = 0;
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
  cards.forEach((card) => { card.classList.add("waiting"); watcher.observe(card); });
}

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

/* ---------- 3. SITE-WIDE ---------- */
function setupSite() {
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
  const button = $(".menu-button");
  const menu = $(".menu");
  if (button && menu) button.addEventListener("click", () => menu.classList.toggle("open"));
}

/* ---------- 4. HOME & LIST ---------- */
async function setupHome() {
  const recent = $("#recent");
  const recent2 = $("#recent-2");
  const { data: all, error } = await db.from('obituaries').select('*').order('created_at', { ascending: false });
  if (error) return;
  if (recent) { recent.innerHTML = all.slice(0, 4).map(cardHTML).join(""); cardEffects(recent); }
  if (recent2) { recent2.innerHTML = all.slice(4, 8).map(cardHTML).join(""); cardEffects(recent2); }
  revealOnScroll(document.querySelectorAll(".service"));
}

async function setupList() {
  const list = $("#list"), search = $("#q"), county = $("#county");
  if (!list) return;
  const { data: all, error } = await db.from('obituaries').select('*').order('created_at', { ascending: false });
  if (error) return;
  
  const counties = [...new Set(all.map((o) => o.county))].sort();
  counties.forEach((c) => { if(c) county.add(new Option(c, c)); });

  function show() {
    const word = search.value.trim().toLowerCase();
    const results = all.filter((o) => (county.value === "" || o.county === county.value) && (word === "" || o.name.toLowerCase().includes(word)));
    $("#count").textContent = results.length + " obituaries found";
    list.innerHTML = results.length ? results.map(cardHTML).join("") : '<p class="empty">No obituaries found.</p>';
    cardEffects(list);
  }
  search.addEventListener("input", show);
  county.addEventListener("change", show);
  $("#clear").addEventListener("click", () => { search.value = ""; county.value = ""; show(); });
  show();
}

/* ---------- 5. SUBMIT PAGE (FREE POSTING) ---------- */
let pendingObituary = null;
let pendingFiles = { photo: null, gallery: [], program: null };

function checkFields(fields) {
  let ok = true;
  fields.forEach((field) => {
    const error = field.parentElement.querySelector(".error");
    let message = "";
    if (field.required && field.value.trim() === "") message = "This field is required.";
    else if (field.type === "email" && field.value && !/^\S+@\S+\.\S+$/.test(field.value)) message = "Enter a valid email.";
    if (error) error.textContent = message;
    field.classList.toggle("bad", message !== "");
    if (message) ok = false;
  });
  return ok;
}

function setupSubmit() {
  const form = $("#submit-form");
  if (!form) return;
  const get = (id) => $("#" + id);

  function updatePreview() {
    const name = get("name").value.trim() || "Full name";
    $("#pv-init").textContent = initials(name);
    $("#pv-name").textContent = name;
    $("#pv-dates").textContent = (get("born").value.slice(0,4) || "") + " – " + (get("died").value.slice(0,4) || "");
    $("#pv-story").textContent = get("story").value.slice(0, 120) || "A short life story...";
    $("#pv-county").textContent = (get("county").value || "County") + " County";
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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const required = ["name", "born", "died", "county", "story", "contact", "email"].map(get);
    if (!checkFields(required)) return;

    pendingFiles.photo = get("photo").files[0];
    pendingFiles.program = get("program").files[0];

    const born = get("born").value.slice(0, 4);
    const died = get("died").value;
    const story = get("story").value.trim();

    pendingObituary = {
      name: get("name").value.trim(), 
      born: born, died: died, age: Number(died.slice(0, 4)) - Number(born),
      county: get("county").value, 
      summary: story.slice(0, 110) + (story.length > 110 ? "…" : ""), 
      story: story,
      service: get("service").value.trim(), 
      burial: get("burial").value.trim(), 
      livestream: get("livestream")?.value.trim() || "",
      mpesa_number: get("mpesa-number")?.value.trim() || "", 
      mpesa_name: get("mpesa-name")?.value.trim() || "",
      bank_name: get("bank-name")?.value.trim() || "", 
      bank_account: get("bank-account")?.value.trim() || "",
      bank_holder: get("bank-holder")?.value.trim() || "", 
      contribution_contact: get("contribution-contact")?.value.trim() || "",
      fund_target: get("fund-target")?.value ? Number(get("fund-target").value) : 0,
      fund_reason: get("fund-reason")?.value.trim() || "",
      secure_pin: "GOOGLE_AUTH", // Deprecated, but keeping for DB constraint if needed
      family_email: get("email").value.trim(),
      family_phone: get("phone")?.value.trim() || "",
      gallery_urls: [] // Starts empty, paid for later
    };

    $("#prev-name").textContent = pendingObituary.name;
    $("#prev-born").textContent = pendingObituary.born;
    $("#prev-died").textContent = pendingObituary.died.slice(0, 4);
    $("#prev-summary").textContent = pendingObituary.summary;
    $("#prev-county").textContent = pendingObituary.county;
    $("#prev-story").innerHTML = pendingObituary.story.split(/\n+/).filter(Boolean).map((text) => `<p>${safe(text)}</p>`).join("");
    
    if (pendingFiles.photo) {
      const photoUrl = URL.createObjectURL(pendingFiles.photo);
      $("#prev-portrait").innerHTML = `<img src="${photoUrl}" alt="Photo">`;
      $("#prev-bg").style.backgroundImage = `url("${photoUrl}")`;
    } else {
      $("#prev-portrait").textContent = initials(pendingObituary.name);
      $("#prev-bg").style.backgroundImage = 'none';
    }

    let funeralHTML = "";
    if (pendingObituary.service || pendingObituary.burial) {
      funeralHTML += `<h2 class="ornate">Funeral details</h2><div class="details">`;
      if (pendingObituary.service) funeralHTML += `<div class="detail"><b>Memorial service</b><p>${safe(pendingObituary.service)}</p></div>`;
      if (pendingObituary.burial) funeralHTML += `<div class="detail"><b>Burial</b><p>${safe(pendingObituary.burial)}</p></div>`;
      funeralHTML += `</div>`;
    }
    $("#prev-funeral-details").innerHTML = funeralHTML;

    document.getElementById("form-section").style.display = "none";
    document.getElementById("preview-section").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.getElementById("back-to-edit").addEventListener("click", () => {
    document.getElementById("preview-section").style.display = "none";
    document.getElementById("form-section").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // DIRECT PUBLISH (NO PAYMENT)
  document.getElementById("publish-btn").addEventListener("click", async () => {
    const btn = document.getElementById("publish-btn");
    btn.textContent = 'Publishing...';
    btn.disabled = true;

    const photoUrl = await uploadFile(pendingFiles.photo, 'photos');
    const programUrl = await uploadFile(pendingFiles.program, 'programs');

    pendingObituary.photo_url = photoUrl;
    pendingObituary.program_url = programUrl;

    const { data, error } = await db.from('obituaries').insert([pendingObituary]).select();
    if (error) {
      alert("Database Error: " + error.message);
      btn.textContent = 'Publish Obituary Now'; btn.disabled = false;
      return;
    }

    const newId = data[0].id;
    document.getElementById("success-email").textContent = pendingObituary.family_email;
    
    document.getElementById("success-review").innerHTML = `
      <div style="background: #fff; padding: 12px; border: 1px solid var(--line); border-radius: 6px; grid-column: 1 / -1;">
        <strong style="color: var(--gold); display: block; font-size: 0.8rem; text-transform: uppercase;">Published Obituary</strong>
        <span style="font-size: 1.1rem; font-weight: 700;">${safe(pendingObituary.name)}</span><br>
        <span class="small">${pendingObituary.born} – ${pendingObituary.died} | ${safe(pendingObituary.county)} County</span>
      </div>
    `;

    document.getElementById("preview-section").style.display = "none";
    document.getElementById("success-section").style.display = "block";
    document.getElementById("success-view-btn").href = `obituary.html?id=${newId}`;
    document.getElementById("success-manage-btn").href = `dashboard.html`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ---------- 6. RECEIPT GENERATOR (INVOICES) ---------- */
function generateReceipt(receiptNum, amount, purpose, payerName, deceasedName = "") {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#bc7504";
  ctx.fillRect(0, 0, canvas.width, 20);

  ctx.textAlign = "center";
  ctx.fillStyle = "#1f2a3d";
  ctx.font = "bold 36px Arial, sans-serif";
  ctx.fillText("TRIBUTE HUB", canvas.width / 2, 80);
  
  ctx.fillStyle = "#4a566b";
  ctx.font = "18px Arial, sans-serif";
  ctx.fillText("An official service of Ndanda Events", canvas.width / 2, 110);

  ctx.beginPath();
  ctx.moveTo(100, 150);
  ctx.lineTo(700, 150);
  ctx.strokeStyle = "#e6dfd1";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#bc7504";
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText("OFFICIAL PAYMENT INVOICE", canvas.width / 2, 200);

  ctx.textAlign = "left";
  ctx.fillStyle = "#1f2a3d";
  ctx.font = "16px Arial, sans-serif";

  let y = 260;
  const drawRow = (label, value) => {
    ctx.font = "bold 16px Arial, sans-serif";
    ctx.fillText(label, 100, y);
    ctx.font = "16px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(value, 700, y);
    ctx.textAlign = "left";
    y += 40;
  };

  drawRow("Date:", new Date().toLocaleDateString("en-KE", { day: 'numeric', month: 'long', year: 'numeric' }));
  drawRow("M-Pesa Receipt No:", receiptNum);
  drawRow("Status:", "PAID");
  drawRow("Payment For:", purpose);
  if (deceasedName) drawRow("Memorial For:", deceasedName);
  drawRow("Paid By:", payerName || "Guest");
  
  y += 20;
  ctx.beginPath();
  ctx.moveTo(100, y);
  ctx.lineTo(700, y);
  ctx.strokeStyle = "#e6dfd1";
  ctx.lineWidth = 2;
  ctx.stroke();
  y += 40;

  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillText("Total Amount Paid:", 100, y);
  ctx.textAlign = "right";
  ctx.font = "bold 28px Arial, sans-serif";
  ctx.fillStyle = "#bc7504";
  ctx.fillText(`KSh ${Number(amount).toLocaleString()}`, 700, y);
  ctx.textAlign = "left";
  
  y += 60;
  ctx.beginPath();
  ctx.moveTo(100, y);
  ctx.lineTo(700, y);
  ctx.strokeStyle = "#e6dfd1";
  ctx.lineWidth = 2;
  ctx.stroke();

  y += 80;
  ctx.textAlign = "center";
  ctx.fillStyle = "#4a566b";
  ctx.font = "italic 16px Georgia, serif";
  ctx.fillText("Thank you for using Tribute Hub.", canvas.width / 2, y);
  
  y += 30;
  ctx.font = "14px Arial, sans-serif";
  ctx.fillStyle = "#8892a6";
  ctx.fillText("For support, contact 0717602094 or 0792487000", canvas.width / 2, y);
  ctx.fillText("www.ndandaevents.com", canvas.width / 2, y + 25);

  ctx.fillStyle = "#bc7504";
  ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

  const link = document.createElement("a");
  link.download = `TributeHub-Invoice-${receiptNum}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/* ---------- 7. SINGLE OBITUARY PAGE (Paywalls & Sticky Socials) ---------- */
async function setupObituary() {
  const id = new URLSearchParams(location.search).get("id");
  const page = $("#obituary");
  if (!page) return;

  page.innerHTML = "<div class='container section center'><p>Loading memorial...</p></div>";
  const { data: o, error } = await db.from('obituaries').select('*').eq('id', id).single();
  if (error || !o) { page.innerHTML = '<h1>Obituary not found</h1>'; return; }
  document.title = o.name + " | Tribute Hub";

  // --- SETUP STICKY SOCIALS & QR ---
  const refCode = "REF-" + id.substring(0, 5).toUpperCase();
  const shareUrl = `${location.origin}${location.pathname}?id=${id}&ref=${refCode}`;
  
  if ($("#sticky-whatsapp")) $("#sticky-whatsapp").href = `https://wa.me/?text=In%20loving%20memory%20of%20${o.name}.%20View%20here:%20${encodeURIComponent(shareUrl)}`;
  if ($("#sticky-youtube")) {
    if (o.livestream) $("#sticky-youtube").href = o.livestream;
    else $("#sticky-youtube").style.display = 'none';
  }
  
  if ($("#show-qr-btn")) {
    $("#show-qr-btn").onclick = () => {
      $("#qr-modal").hidden = false;
      document.body.style.overflow = 'hidden';
      if ($("#qr-link-text")) $("#qr-link-text").textContent = shareUrl;
      if ($("#qr-container")) $("#qr-container").innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}" alt="QR Code">`;
    };
  }
  if ($("#close-qr-modal")) $("#close-qr-modal").onclick = () => { $("#qr-modal").hidden = true; document.body.style.overflow = ''; };

  function getVideoId(url) {
    if (!url) return "";
    const trimmed = url.trim();
    if (trimmed.includes("youtube.com/embed/")) return trimmed.split("embed/")[1].split(/[?&#]/)[0];
    const liveMatch = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
    if (liveMatch) return liveMatch[1];
    const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    return "";
  }

  const videoId = getVideoId(o.livestream);
  const isUnlocked = localStorage.getItem("unlocked_livestream_" + o.id) === "true";

  const paragraphs = o.story.split(/\n+/).filter(Boolean).map((text) => `<p>${safe(text)}</p>`).join("");
  const minutes = Math.max(1, Math.round(o.story.split(/\s+/).length / 200));
  const diedLong = new Date(o.died).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
  const portrait = o.photo_url ? `<img src="${safe(o.photo_url)}" alt="Photo of ${safe(o.name)}">` : initials(o.name);

  const galleryHTML = (o.gallery_urls && o.gallery_urls.length > 0) ? `
      <h2 class="ornate">Photo Gallery</h2>
      <div class="gallery-grid">
        ${o.gallery_urls.map(img => `<a href="${img}" target="_blank"><img src="${img}" alt="Gallery Photo"></a>`).join("")}
      </div>
    ` : "";

  const livestreamSection = videoId ? `
      <h2 class="ornate">Watch the Funeral</h2>
      <p class="small center" style="margin-bottom: 16px;">Premium Livestream (KSh 200).</p>
      <div class="video-thumbnail-wrap" id="video-wrap">
        ${o.photo_url ? `<img src="${safe(o.photo_url)}" alt="Video Thumbnail" class="video-thumb-img">` : `<div class="video-thumb-img" style="background: linear-gradient(135deg, #2f4a6d, #1f2a3d); display: grid; place-items: center; color: #fff; font-size: 4rem;">${initials(o.name)}</div>`}
        <div class="video-overlay"></div>
        <button class="video-play-btn" id="play-livestream-trigger" data-video-id="${videoId}" type="button" aria-label="Play livestream">
          <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
    ` : "";

  const serviceMap = o.service ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.service)}" target="_blank" class="btn outline" style="padding: 6px 12px; font-size: 0.8rem; margin-top: 10px;">📍 Get Directions</a>` : "";
  const burialMap = o.burial ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.burial)}" target="_blank" class="btn outline" style="padding: 6px 12px; font-size: 0.8rem; margin-top: 10px;">📍 Get Directions</a>` : "";

  const details = (o.service || o.burial) ? `
      <h2 class="ornate">Funeral details</h2>
      <div class="details">
        ${o.service ? `<div class="detail"><b>Memorial service</b><p>${safe(o.service)}</p>${serviceMap}</div>` : ""}
        ${o.burial ? `<div class="detail"><b>Burial</b><p>${safe(o.burial)}</p>${burialMap}</div>` : ""}
      </div>` : "";

  const program = o.program_url ? `
      <h2 class="ornate">Funeral program</h2>
      <p class="small center">Download or view the program below.</p>
      <p class="center" style="margin-top:14px"><a class="btn gold" href="${o.program_url}" target="_blank">⬇ Download the program (PDF)</a></p>` : "";

  const hasFundTarget = o.fund_target > 0;

  const contribution = (o.mpesa_number || o.bank_name || hasFundTarget) ? `
      <div class="side-box" id="support-widget">
        <h3>Contribute to the family</h3>
        ${hasFundTarget ? `
          <p class="small" style="margin-bottom: 10px;">${safe(o.fund_reason || 'Help the family with funeral expenses.')}</p>
          <div class="fund-progress">
            <div class="fund-stats">
              <span><strong id="fund-raised">KSh 0</strong> paid</span>
              <span>Target: KSh ${Number(o.fund_target).toLocaleString()}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" id="fund-bar" style="width: 0%"></div></div>
          </div>
          <div class="ledger-summary" id="ledger-summary">
            <div>Pledged<br><strong id="sum-pledged">KSh 0</strong></div>
            <div>Paid<br><strong id="sum-paid">KSh 0</strong></div>
            <div>Balance<br><strong id="sum-balance">KSh 0</strong></div>
          </div>
          <button class="btn gold" id="btn-contribute" style="width:100%; margin-top: 16px;">Contribute via M-Pesa</button>
          <h4 style="margin-top: 24px; font-size: 0.9rem; color: var(--soft);">Recent Contributions</h4>
          <div id="ledger-list" style="max-height: 200px; overflow-y: auto;">
             <p class="small">Loading...</p>
          </div>
        ` : `
          ${o.mpesa_number ? `<p><b>M-Pesa</b><br>${safe(o.mpesa_number)} ${o.mpesa_name ? "<span class='small'>(" + safe(o.mpesa_name) + ")</span>" : ""}</p>` : ""}
          ${o.bank_name ? `<p><b>Bank</b><br>${safe(o.bank_name || "")} · ${safe(o.bank_account || "")}<br><span class="small">${safe(o.bank_holder || "")}</span></p>` : ""}
        `}
      </div>` : "";

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
        
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px; flex-wrap: wrap;">
          <button class="btn gold" id="candle">🔥 Light a candle</button>
          ${hasFundTarget ? `<button class="btn gold" id="btn-contribute-hero">🤍 Contribute</button>` : ""}
        </div>
        <span id="candle-count" class="small" style="display: block; margin-top: 12px; color: #c9d2e0;"></span>
      </div>
    </header>

    <div class="container" style="margin-top: 30px; margin-bottom: 10px;">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; align-items: start;">
        ${contribution}
        <div class="side-box">
          <h3>Share this tribute</h3>
          <button class="btn gold share" id="download-poster" type="button">⬇ Download Announcement Poster</button>
          <a class="btn outline share" id="whatsapp" target="_blank" rel="noopener">Share on WhatsApp</a>
          <button class="btn outline share" id="copy" type="button">Copy link</button>
        </div>
      </div>
    </div>

    <section class="section" style="padding-top: 20px;">
      <div class="container post-layout">
        <article class="post">
          <h2 class="ornate" style="margin-top:0">Life story</h2>
          <div class="post-text">${paragraphs}</div>
          
          ${galleryHTML}

          <div id="livestream-section">${livestreamSection}</div>
          ${details}
          ${program}

          <h2 class="ornate" id="comments-title">Tributes</h2>
          <div id="tributes"><p class="small">Loading tributes...</p></div>
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
          
          ${localStorage.getItem("my_memorials")?.includes(o.id) ? `
          <div class="side-box" style="background: #faf7f1; border-color: var(--gold);">
            <h3>Family Controls</h3>
            <p class="small" style="margin-bottom: 12px;">You created this page on this device.</p>
            <a href="dashboard.html" class="btn gold" style="width: 100%;">Manage Memorial</a>
          </div>
          ` : ""}
        </aside>
      </div>
    </section>`;

  if (o.photo_url) $("#hero-bg").style.backgroundImage = 'url("' + o.photo_url + '")';

  // Candles
  const candleKey = "candles_" + o.id;
  function showCandles() {
    const n = Number(localStorage.getItem(candleKey) || 0);
    $("#candle-count").textContent = n ? n + " candle(s) lit in memory" : "Be the first to light a candle";
  }
  $("#candle").addEventListener("click", () => { 
    const n = Number(localStorage.getItem(candleKey) || 0) + 1;
    localStorage.setItem(candleKey, n);
    showCandles(); 
  });
  showCandles();

  // --- LIVESTREAM PAYWALL LOGIC ---
  if (videoId) {
    document.getElementById("play-livestream-trigger").onclick = () => {
      if (isUnlocked) {
        playVideo(videoId);
      } else {
        $("#livestream-paywall").hidden = false;
        document.body.style.overflow = 'hidden';
      }
    };

    $("#close-paywall-modal").onclick = () => { $("#livestream-paywall").hidden = true; document.body.style.overflow = ''; };
    
    $("#pay-livestream-btn").onclick = async () => {
      const phone = $("#paywall-phone").value.trim();
      if (!phone) return alert("Enter your M-Pesa number");
      
      const btn = $("#pay-livestream-btn");
      btn.style.display = 'none';
      $("#paywall-waiting").style.display = 'block';

      try {
        const { data, error } = await db.functions.invoke('mpesa-stk-push', {
          body: { phone, amount: 200, obituaryId: o.id, accountRef: "Livestream", donorName: "Viewer" }
        });
        if (error) throw error;

        if (data.CheckoutRequestID) {
          const poll = setInterval(async () => {
            const { data: txn } = await db.from('mpesa_transactions').select('status, mpesa_receipt').eq('checkout_request_id', data.CheckoutRequestID).single();
            if (txn && txn.status === 'paid') {
              clearInterval(poll);
              localStorage.setItem("unlocked_livestream_" + o.id, "true");
              generateReceipt(txn.mpesa_receipt || "N/A", 200, "Livestream Access", "Guest", o.name);
              $("#livestream-paywall").hidden = true;
              document.body.style.overflow = '';
              playVideo(videoId);
            }
          }, 3000);
        }
      } catch (err) {
        alert("Payment failed. Try again.");
        btn.style.display = 'block';
        $("#paywall-waiting").style.display = 'none';
      }
    };
  }

  function playVideo(vid) {
    const wrap = $("#video-wrap");
    wrap.innerHTML = `<div class="youtube-player-holder"><iframe src="https://www.youtube.com/embed/${vid}?autoplay=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="width:100%; height:100%; border:0;"></iframe></div>`;
  }

  // Share buttons
  $("#whatsapp").href = "https://wa.me/?text=" + encodeURIComponent(`In loving memory of ${o.name}. View the memorial and leave a tribute here: ${shareUrl}`);
  $("#copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(shareUrl); $("#copy").textContent = "Link copied ✓"; }
    catch (e) { $("#copy").textContent = "Copy the address from your browser"; }
  });
  $("#download-poster").addEventListener("click", () => generatePoster(o));

  // Tributes logic
  async function showTributes() {
    const { data: list, error } = await db.from('tributes').select('*').eq('obituary_id', o.id).order('created_at', { ascending: false });
    if (error) return;
    
    $("#comments-title").textContent = "Tributes (" + list.length + ")";
    $("#tributes").innerHTML = list.length
      ? list.map((t) => {
          const r = t.reactions || {};
          return `
          <div class="comment">
            <div class="c-avatar">${initials(t.name)}</div>
            <div style="flex: 1;">
              <b>${safe(t.name)}</b> <span class="small">· ${new Date(t.created_at).toLocaleDateString("en-KE")}</span>
              <p>${safe(t.message)}</p>
              <div class="tribute-reactions">
                <button onclick="reactToTribute('${t.id}', 'heart')">❤️ ${r.heart || 0}</button>
                <button onclick="reactToTribute('${t.id}', 'pray')">🙏 ${r.pray || 0}</button>
                <button onclick="reactToTribute('${t.id}', 'candle')">🕯️ ${r.candle || 0}</button>
              </div>
            </div>
          </div>`;
        }).join("")
      : '<p class="small">No tributes yet. Be the first to share a memory.</p>';
  }
  
  window.reactToTribute = async (tributeId, type) => {
    const { data } = await db.from('tributes').select('reactions').eq('id', tributeId).single();
    let r = data.reactions || {};
    r[type] = (r[type] || 0) + 1;
    await db.from('tributes').update({ reactions: r }).eq('id', tributeId);
    showTributes();
  };

  $("#tribute-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#t-name");
    const message = $("#t-msg");
    if (!checkFields([name, message])) return;
    
    const btn = event.target.querySelector('button[type="submit"]');
    btn.textContent = "Posting...";
    btn.disabled = true;

    const { error } = await db.from('tributes').insert([{ obituary_id: o.id, name: name.value.trim(), message: message.value.trim() }]);

    if (error) alert("Could not post tribute.");
    else {
      name.value = "";
      message.value = "";
      await showTributes();
    }
    btn.textContent = "Post tribute";
    btn.disabled = false;
  });
  
  showTributes();

  // Contributions Ledger
  async function loadLedger() {
    if (!hasFundTarget) return;
    const { data: donations } = await db.from('donations').select('*').eq('obituary_id', o.id).order('created_at', { ascending: false });
    if (!donations) return;

    let totalPledged = 0;
    let totalPaid = 0;
    donations.forEach(d => { totalPledged += (d.pledge_amount || 0); totalPaid += (d.paid_amount || 0); });
    const balance = totalPledged - totalPaid;

    $("#sum-pledged").textContent = "KSh " + totalPledged.toLocaleString();
    $("#sum-paid").textContent = "KSh " + totalPaid.toLocaleString();
    $("#sum-balance").textContent = "KSh " + balance.toLocaleString();
    
    const pct = Math.min((totalPaid / o.fund_target) * 100, 100);
    if ($("#fund-raised")) $("#fund-raised").textContent = `KSh ${totalPaid.toLocaleString()}`;
    if ($("#fund-bar")) $("#fund-bar").style.width = `${pct}%`;

    const list = $("#ledger-list");
    if (donations.length === 0) list.innerHTML = '<p class="small">No contributions yet.</p>';
    else {
      list.innerHTML = `<table class="ledger-table">
        <thead><tr><th>Name</th><th>Pledged</th><th>Paid</th><th>Status</th></tr></thead>
        <tbody>
          ${donations.map(d => `
            <tr>
              <td>${safe(d.donor_name)}</td>
              <td>${(d.pledge_amount || 0).toLocaleString()}</td>
              <td>${(d.paid_amount || 0).toLocaleString()}</td>
              <td class="${d.paid_amount >= d.pledge_amount ? 'paid' : 'pending'}">
                ${d.paid_amount >= d.pledge_amount ? 'Paid' : 'Pending'}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
    }
  }

  loadLedger();

  const openContributeModal = () => {
    $("#contribute-modal").hidden = false;
    document.body.style.overflow = 'hidden';
  };
  
  if ($("#btn-contribute")) $("#btn-contribute").onclick = openContributeModal;
  if ($("#btn-contribute-hero")) $("#btn-contribute-hero").onclick = openContributeModal;

  if (hasFundTarget) {
    $("#close-modal").onclick = () => {
      $("#contribute-modal").hidden = true;
      document.body.style.overflow = '';
      if (typeof resetFormUI === "function") resetFormUI();
    };

    const amountInput = $("#c-amount");
    const actionInput = $("#c-action");
    const submitBtn   = $("#submit-contribution");
    let currentAction = "pay";

    const updateSubmitLabel = () => {
      const amt = Number(amountInput.value || 0);
      const formatted = amt.toLocaleString();
      if (currentAction === "pay") {
        submitBtn.innerHTML = amt > 0 ? `Pay KSh ${formatted} Now` : `Pay Now`;
      } else {
        submitBtn.innerHTML = amt > 0 ? `Pledge KSh ${formatted}` : `Pledge`;
      }
    };

    document.querySelectorAll('.btn-amount').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.btn-amount').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        amountInput.value = btn.dataset.amt;
        updateSubmitLabel();
      };
    });

    amountInput.oninput = () => {
      document.querySelectorAll('.btn-amount').forEach(b => b.classList.remove('active'));
      updateSubmitLabel();
    };

    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentAction = btn.dataset.action;
        actionInput.value = currentAction;
        updateSubmitLabel();
      };
    });

    updateSubmitLabel();

    $("#contribute-form").onsubmit = async (e) => {
      e.preventDefault();
      const amt = Number(amountInput.value);
      const name = $("#c-name").value.trim();
      const phone = $("#c-phone").value.trim();
      
      if (!amt || amt < 1) return amountInput.focus();
      if (!name || !phone) return;

      if (currentAction === 'pledge') {
        const { error } = await db.from('donations').insert([{
          obituary_id: o.id, donor_name: name, donor_phone: phone,
          amount: amt, pledge_amount: amt, paid_amount: 0, status: 'pending'
        }]);
        if (error) alert("Error recording pledge.");
        else {
          alert("Your pledge has been recorded.");
          $("#contribute-modal").hidden = true;
          document.body.style.overflow = '';
          loadLedger();
        }
        return;
      }

      $("#form-amount-group").style.display = "none";
      $("#form-action-group").style.display = "none";
      $("#form-name-group").style.display = "none";
      $("#form-phone-group").style.display = "none";
      $("#submit-contribution").style.display = "none";
      $("#mpesa-waiting").style.display = "block";

      try {
        const { data, error } = await db.functions.invoke('mpesa-stk-push', {
          body: { phone, amount: amt, obituaryId: o.id, accountRef: o.name.substring(0, 12), donorName: name }
        });

        if (error) {
          let errorMsg = "Payment request failed. Please check the phone number.";
          if (error.context) {
            try {
              const errJson = await error.context.json();
              if (errJson && errJson.error) errorMsg = errJson.error;
            } catch (e) {}
          }
          throw new Error(errorMsg);
        }

        if (data.CheckoutRequestID) {
          const checkoutId = data.CheckoutRequestID;
          let secondsWaited = 0;
          
          const pollInterval = setInterval(async () => {
            secondsWaited += 3;
            const { data: txn } = await db.from('mpesa_transactions')
              .select('status, mpesa_receipt')
              .eq('checkout_request_id', checkoutId)
              .maybeSingle();

            if (txn && txn.status === 'paid') {
              clearInterval(pollInterval);
              generateReceipt(txn.mpesa_receipt || "N/A", amt, "Family Contribution", name, o.name);
              
              $("#contribute-modal").hidden = true;
              document.body.style.overflow = '';
              loadLedger();
              resetFormUI();
            } 
            else if (txn && txn.status === 'failed') {
              clearInterval(pollInterval);
              alert("Payment failed or was cancelled. Please try again.");
              resetFormUI();
            }
            else if (secondsWaited >= 60) {
              clearInterval(pollInterval);
              $("#mpesa-waiting").style.display = "none";
              $("#mpesa-manual").style.display = "block";
            }
          }, 3000);
        } else {
          alert(`Payment request failed: ${data.error || 'Please check your details and try again.'}`);
          resetFormUI();
        }
      } catch (err) {
        console.error(err);
        alert(`Error initiating payment: ${err.message}`);
        resetFormUI();
      }
    };

    window.resetFormUI = () => {
      $("#mpesa-waiting").style.display = "none";
      $("#mpesa-manual").style.display = "none";
      $("#form-amount-group").style.display = "block";
      $("#form-action-group").style.display = "block";
      $("#form-name-group").style.display = "block";
      $("#form-phone-group").style.display = "block";
      $("#submit-contribution").style.display = "block";
    };

    $("#show-manual-btn").onclick = () => {
      $("#mpesa-waiting").style.display = "none";
      $("#mpesa-manual").style.display = "block";
    };

    $("#submit-manual-btn").onclick = async () => {
      const receipt = $("#manual-receipt").value.trim().toUpperCase();
      if (!receipt || receipt.length < 10) return alert("Please enter a valid M-Pesa receipt code.");

      const btn = $("#submit-manual-btn");
      btn.textContent = 'Verifying...';
      btn.disabled = true;

      const amt = Number($("#c-amount").value);
      const name = $("#c-name").value.trim();
      const phone = $("#c-phone").value.trim();

      await db.from('mpesa_transactions').insert([{
        obituary_id: o.id, phone_number: phone, amount: amt,
        mpesa_receipt: receipt, status: 'manual_review', is_manual: true
      }]);

      await db.from('donations').insert([{
        obituary_id: o.id, donor_name: name, donor_phone: phone,
        pledge_amount: amt, paid_amount: 0, status: 'pending', mpesa_receipt: receipt
      }]);

      alert("Thank you! Your receipt has been submitted. The administrator will verify it shortly.");
      $("#contribute-modal").hidden = true;
      document.body.style.overflow = '';
      resetFormUI();
      $("#contribute-form").reset();
    };
  }
}

/* ---------- 7b. ANNOUNCEMENT POSTER GENERATOR ---------- */
function generatePoster(o) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");

  ctx.textAlign = "center";

  const drawTextAndFinish = (img) => {
    if (img) {
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width / 2) - (img.width / 2) * scale;
      const y = (canvas.height / 2) - (img.height / 2) * scale;
      const w = img.width * scale;
      const h = img.height * scale;

      ctx.filter = 'blur(24px)';
      ctx.drawImage(img, x - 20, y - 20, w + 40, h + 40);
      ctx.filter = 'none';
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#1f2a3d");
      gradient.addColorStop(1, "#0f1624");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const overlay = ctx.createLinearGradient(0, 0, 0, canvas.height);
    overlay.addColorStop(0, "rgba(15, 22, 36, 0.78)");
    overlay.addColorStop(1, "rgba(15, 22, 36, 0.92)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#f0c36b";
    ctx.font = "600 20px Arial, sans-serif";
    ctx.fillText("I N   L O V I N G   M E M O R Y", canvas.width / 2, 120);

    if (img) {
      const size = 320;
      const x = (canvas.width - size) / 2;
      const y = 200;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(canvas.width / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x, y, size, size);
      ctx.restore();
      
      ctx.beginPath();
      ctx.arc(canvas.width / 2, y + size / 2, size / 2 + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#f0c36b";
      ctx.lineWidth = 8;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 360, 160, 0, Math.PI * 2);
      ctx.fillStyle = "#2f4a6d";
      ctx.fill();
      ctx.strokeStyle = "#f0c36b";
      ctx.lineWidth = 8;
      ctx.stroke();
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 110px Georgia, serif";
      ctx.fillText(initials(o.name), canvas.width / 2, 395);
    }

    let yOffset = 620;

    ctx.fillStyle = "#ffffff";
    ctx.font = "italic 64px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText(o.name, canvas.width / 2, yOffset);
    yOffset += 80;

    ctx.fillStyle = "#aab6c9";
    ctx.font = "600 24px Arial, sans-serif";
    const bornText = `SUNRISE ${o.born}`;
    const diedText = `SUNSET ${o.died.slice(0, 4)}`;
    const midX = canvas.width / 2;
    
    ctx.fillText(bornText, midX - 130, yOffset);
    ctx.fillText(diedText, midX + 130, yOffset);
    
    ctx.fillStyle = "#f0c36b";
    ctx.font = "28px Arial, sans-serif";
    ctx.fillText("✦", midX, yOffset + 2);
    
    yOffset += 70;

    ctx.fillStyle = "#e8edf5";
    ctx.font = "italic 32px 'Cormorant Garamond', Georgia, serif";
    const summary = o.summary || "";
    const words = summary.split(" ");
    let line = "";
    let lines = [];
    words.forEach(word => {
      if (ctx.measureText(line + word).width > 800) {
        lines.push(line);
        line = word + " ";
      } else {
        line += word + " ";
      }
    });
    lines.push(line);
    lines.forEach(l => {
      ctx.fillText(l.trim(), canvas.width / 2, yOffset);
      yOffset += 40;
    });

    yOffset += 20;

    ctx.fillStyle = "#aab6c9";
    ctx.font = "400 24px Arial, sans-serif";
    ctx.fillText(`Age ${o.age} · ${o.county} County`, canvas.width / 2, yOffset);

    yOffset += 60;

    if (o.service || o.burial) {
      ctx.fillStyle = "#f0c36b";
      ctx.font = "600 20px Arial, sans-serif";
      ctx.fillText("F U N E R A L   D E T A I L S", canvas.width / 2, yOffset);
      yOffset += 40;

      ctx.fillStyle = "#ffffff";
      ctx.font = "400 22px Arial, sans-serif";

      if (o.service) {
        ctx.fillText("Memorial Service:", canvas.width / 2, yOffset);
        yOffset += 30;
        ctx.fillStyle = "#c9d2e0";
        ctx.fillText(o.service, canvas.width / 2, yOffset);
        yOffset += 40;
        ctx.fillStyle = "#ffffff";
      }

      if (o.burial) {
        ctx.fillText("Burial:", canvas.width / 2, yOffset);
        yOffset += 30;
        ctx.fillStyle = "#c9d2e0";
        ctx.fillText(o.burial, canvas.width / 2, yOffset);
        yOffset += 40;
      }
    }

    ctx.fillStyle = "#8892a6";
    ctx.font = "600 22px Arial, sans-serif";
    ctx.fillText("TributeHub.com", canvas.width / 2, canvas.height - 80);

    const link = document.createElement("a");
    link.download = `${o.name.replace(/\s+/g, '-')}-Announcement.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  if (o.photo_url) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => drawTextAndFinish(img);
    img.onerror = () => drawTextAndFinish(null);
    img.src = o.photo_url;
  } else {
    drawTextAndFinish(null);
  }
}

/* ---------- 8. FAMILY DASHBOARD (Google Auth) ---------- */
async function setupDashboard() {
  const loginGate = $("#login-gate");
  const dashboard = $("#dashboard-content");
  const googleBtn = $("#google-login-btn");
  const logoutBtn = $("#logout-btn");
  
  let currentObituary = null;

  // Check Auth State
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    showDashboard(session.user.email);
  } else {
    loginGate.style.display = "block";
    dashboard.style.display = "none";
  }

  if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
      const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
      });
      if (error) alert("Google Login Error: " + error.message);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await db.auth.signOut();
      window.location.reload();
    });
  }

  async function showDashboard(email) {
    loginGate.style.display = "none";
    
    // Find obituary matching this email
    const { data, error } = await db.from('obituaries').select('*').eq('family_email', email).limit(1).single();
    
    if (error || !data) {
      alert("No memorial found linked to " + email + ". Please ensure you used this email when submitting the obituary.");
      await db.auth.signOut();
      window.location.reload();
      return;
    }

    currentObituary = data;
    dashboard.style.display = "block";
    $("#dash-name").textContent = currentObituary.name;
    $("#dash-view-link").href = `obituary.html?id=${currentObituary.id}`;
    
    // Set Profile Photo
    if (currentObituary.photo_url) {
      $("#dash-photo").src = currentObituary.photo_url;
      $("#dash-photo").style.display = "block";
      $("#dash-initials").style.display = "none";
    } else {
      $("#dash-photo").style.display = "none";
      $("#dash-initials").style.display = "grid";
      $("#dash-initials").textContent = initials(currentObituary.name);
    }

    // Load Tributes
    const { data: tribs } = await db.from('tributes').select('*').eq('obituary_id', currentObituary.id).order('created_at', { ascending: false });
    $("#dash-tributes").innerHTML = tribs.length 
      ? tribs.map(t => `<div style="border-bottom: 1px solid #eee; padding: 10px 0;"><b>${safe(t.name)}</b><p>${safe(t.message)}</p></div>`).join("") 
      : "<p>No tributes yet.</p>";

    // Load Donations
    const { data: dons } = await db.from('donations').select('paid_amount').eq('obituary_id', currentObituary.id);
    let raised = 0;
    if (dons) dons.forEach(d => raised += (d.paid_amount || 0));
    $("#dash-raised").textContent = "KSh " + raised.toLocaleString();

    // Setup Premium Service Buttons
    const galleryBtn = $("#btn-add-gallery");
    if (galleryBtn) {
      galleryBtn.onclick = () => {
        alert("Gallery Upload requires an STK Push of KSh 500. This feature will open the upload modal once integrated.");
        // Logic to trigger STK push for 500 and then open an upload modal
      };
    }
  }
}

/* ---------- 9. ADMIN DASHBOARD ---------- */
async function setupAdmin() {
  const loginGate = $("#login-gate");
  const adminContent = $("#admin-content");
  const passInput = $("#admin-pass");
  const loginBtn = $("#login-btn");
  const errorMsg = $("#login-error");
  const logoutBtn = $("#logout-btn");

  const ADMIN_PASSWORD = "Tribute Hub2024"; 

  function checkAuth() {
    if (localStorage.getItem("admin_auth") === "true") {
      loginGate.style.display = "none";
      adminContent.style.display = "block";
      loadAdminData();
    } else {
      loginGate.style.display = "block";
      adminContent.style.display = "none";
    }
  }

  loginBtn.addEventListener("click", () => {
    if (passInput.value === ADMIN_PASSWORD) {
      localStorage.setItem("admin_auth", "true");
      checkAuth();
    } else {
      errorMsg.style.display = "block";
    }
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("admin_auth");
    checkAuth();
  });

  async function loadAdminData() {
    try {
      const { data: obits } = await db.from('obituaries').select('*').order('created_at', { ascending: false });
      let totalFamilyRaised = 0;
      let totalTributes = 0;

      const { data: requests } = await db.from('edit_requests').select('*');
      const alertBanner = $("#admin-alert");
      
      if (requests && requests.length > 0) {
        $("#alert-text").textContent = `You have ${requests.length} pending edit request${requests.length > 1 ? 's' : ''}!`;
        if (alertBanner) alertBanner.style.display = "flex"; 
      } else {
        if (alertBanner) alertBanner.style.display = "none"; 
      }

      // --- FETCH PLATFORM REVENUE (Livestream 200 & Gallery 500) ---
      const { data: platformFees } = await db.from('mpesa_transactions')
        .select('*')
        .in('amount', [200, 500])
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

      let totalRevenue = 0;
      if (platformFees) platformFees.forEach(fee => totalRevenue += fee.amount);
      if ($("#stat-revenue")) $("#stat-revenue").textContent = "KSh " + totalRevenue.toLocaleString();

      const revenueTbody = document.querySelector("#admin-revenue-table tbody");
      if (revenueTbody) {
        revenueTbody.innerHTML = "";
        if (!platformFees || platformFees.length === 0) {
          revenueTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--soft); padding: 10px;">No premium services collected yet.</td></tr>';
        } else {
          platformFees.forEach(fee => {
            revenueTbody.innerHTML += `
              <tr style="border-bottom: 1px solid var(--line);">
                <td style="padding: 10px;">${new Date(fee.created_at).toLocaleDateString("en-KE")}</td>
                <td style="padding: 10px;"><strong>${safe(fee.mpesa_receipt) || 'Processing...'}</strong></td>
                <td style="padding: 10px;">${safe(fee.phone_number)}</td>
                <td style="padding: 10px;">KSh ${fee.amount.toLocaleString()} <br><span class="small">${fee.account_reference}</span></td>
              </tr>
            `;
          });
        }
      }

      const tbody = $("#admin-table tbody");
      if (tbody) {
        tbody.innerHTML = "";
        if (obits) {
          for (const o of obits) {
            const { count: tribs } = await db.from('tributes').select('*', { count: 'exact', head: true }).eq('obituary_id', o.id);
            const { data: donations } = await db.from('donations').select('paid_amount').eq('obituary_id', o.id);
            
            let raised = 0;
            if (donations) donations.forEach(d => raised += (d.paid_amount || 0));
            
            totalFamilyRaised += raised;
            totalTributes += (tribs || 0);

            tbody.innerHTML += `
              <tr>
                <td><strong>${safe(o.name)}</strong></td>
                <td>${safe(o.county)}</td>
                <td>${tribs || 0}</td>
                <td>KSh ${raised.toLocaleString()}</td>
                <td>
                  <a href="obituary.html?id=${encodeURIComponent(o.id)}" class="btn outline" style="padding: 4px 8px; font-size: 0.75rem;" target="_blank">View</a>
                  <button class="btn gold" style="padding: 4px 8px; font-size: 0.75rem;" onclick="openEditModal('${o.id}')">Edit</button>
                  <button class="btn outline" style="padding: 4px 8px; font-size: 0.75rem; color: #b3261e; border-color: #b3261e;" onclick="adminDeleteObituary('${o.id}')">Delete</button>
                </td>
              </tr>
            `;
          }
        }
      }

      if ($("#stat-obits")) $("#stat-obits").textContent = obits ? obits.length : 0;
      if ($("#stat-tributes")) $("#stat-tributes").textContent = totalTributes;
      if ($("#stat-raised")) $("#stat-raised").textContent = "KSh " + totalFamilyRaised.toLocaleString();

      const reqTbody = $("#requests-table tbody");
      if (reqTbody) {
        reqTbody.innerHTML = "";
        if (!requests || requests.length === 0) {
          reqTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--soft);">No pending requests.</td></tr>';
        } else {
          requests.forEach((req) => {
            reqTbody.innerHTML += `
              <tr>
                <td>${new Date(req.created_at).toLocaleDateString("en-KE")}</td>
                <td><strong>${safe(req.obituary_name)}</strong></td>
                <td>${safe(req.message)}</td>
                <td>
                  <button class="btn gold" style="padding: 4px 8px; font-size: 0.75rem;" onclick="openEditModal('${req.obituary_id}', '${req.id}')">Edit & Resolve</button>
                </td>
              </tr>
            `;
          });
        }
      }

      const { data: manualTxns, error: mpesaError } = await db.from('mpesa_transactions').select('*').eq('status', 'manual_review').order('created_at', { ascending: false });
      
      const mpesaTbody = document.querySelector("#admin-mpesa-table tbody");
      if (mpesaTbody) {
        mpesaTbody.innerHTML = "";
        if (mpesaError) {
          mpesaTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red; padding: 10px;">Error loading transactions: ${mpesaError.message}</td></tr>`;
        } else if (!manualTxns || manualTxns.length === 0) {
          mpesaTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--soft); padding: 10px;">No pending manual verifications.</td></tr>';
        } else {
          manualTxns.forEach(txn => {
            mpesaTbody.innerHTML += `
              <tr style="border-bottom: 1px solid var(--line);">
                <td style="padding: 10px;">${new Date(txn.created_at).toLocaleDateString("en-KE")}</td>
                <td style="padding: 10px;"><strong>${safe(txn.mpesa_receipt)}</strong></td>
                <td style="padding: 10px;">${safe(txn.phone_number)}</td>
                <td style="padding: 10px;">KSh ${Number(txn.amount).toLocaleString()}</td>
                <td style="padding: 10px;">
                  <button class="btn gold" style="padding: 4px 8px; font-size: 0.75rem;" onclick="approveManualMpesa('${txn.id}', '${txn.obituary_id}', '${txn.amount}')">Approve</button>
                  <button class="btn outline" style="padding: 4px 8px; font-size: 0.75rem; color: #b3261e; border-color: #b3261e;" onclick="rejectManualMpesa('${txn.id}')">Reject</button>
                </td>
              </tr>
            `;
          });
        }
      }
    } catch (err) {
      console.error("Admin Dashboard Error:", err);
    }
  }

  window.adminDeleteObituary = async (id) => {
    if (!confirm("⚠️ WARNING: This will permanently delete this obituary. Are you sure?")) return;
    await db.from('obituaries').delete().eq('id', id);
    localStorage.removeItem(`raised_${id}`);
    localStorage.removeItem(`candles_${id}`);
    loadAdminData();
  };

  window.openEditModal = async (id, reqId = null) => {
    const { data: obit } = await db.from('obituaries').select('*').eq('id', id).single();
    if (!obit) return;

    $("#edit-id").value = id;
    $("#edit-name").value = obit.name;
    $("#edit-born").value = obit.born + "-01-01"; 
    $("#edit-died").value = obit.died;
    $("#edit-story").value = obit.story;
    $("#edit-service").value = obit.service || "";
    $("#edit-burial").value = obit.burial || "";

    $("#admin-edit-form").dataset.reqId = reqId || "";
    $("#edit-obit-modal").hidden = false;
  };

  $("#close-edit-modal").addEventListener("click", () => {
    $("#edit-obit-modal").hidden = true;
  });

  $("#admin-edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("#edit-id").value;
    
    await db.from('obituaries').update({
      name: $("#edit-name").value.trim(),
      born: $("#edit-born").value.slice(0, 4),
      died: $("#edit-died").value,
      story: $("#edit-story").value.trim(),
      summary: $("#edit-story").value.trim().slice(0, 110) + "…",
      service: $("#edit-service").value.trim(),
      burial: $("#edit-burial").value.trim()
    }).eq('id', id);

    const reqId = e.target.dataset.reqId;
    if (reqId) {
      await db.from('edit_requests').delete().eq('id', reqId);
    }

    $("#edit-obit-modal").hidden = true;
    loadAdminData();
    alert("Changes applied successfully.");
  });

  $("#download-master-report").addEventListener("click", async () => {
    const { data: obits } = await db.from('obituaries').select('*');
    if (!obits || obits.length === 0) return alert("No obituaries on the platform yet.");

    let csv = "Name,County,Date Posted,Funds Raised\n";
    for (const o of obits) {
      const { data: donations } = await db.from('donations').select('paid_amount').eq('obituary_id', o.id);
      let raised = 0;
      if (donations) donations.forEach(d => raised += (d.paid_amount || 0));
      csv += `"${o.name}","${o.county}","${new Date(o.created_at).toLocaleDateString("en-KE")}",${raised}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Tribute-Hub-Master-Report.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  });

  window.approveManualMpesa = async (txnId, obituaryId, amount) => {
    if (!confirm("Have you verified this receipt code in your M-Pesa statement?")) return;
    
    await db.from('mpesa_transactions').update({ status: 'paid', verified_by_admin: true }).eq('id', txnId);
    
    if (obituaryId && obituaryId !== 'null') {
      const { data: pendingDonation } = await db.from('donations').select('id').eq('obituary_id', obituaryId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).single();
      if (pendingDonation) {
        await db.from('donations').update({ paid_amount: Number(amount), status: 'paid' }).eq('id', pendingDonation.id);
      }
    }

    alert("Payment approved!");
    loadAdminData();
  };

  window.rejectManualMpesa = async (txnId) => {
    if (!confirm("Are you sure you want to reject this payment?")) return;
    await db.from('mpesa_transactions').update({ status: 'failed', verified_by_admin: false }).eq('id', txnId);
    alert("Payment rejected.");
    loadAdminData();
  };

  checkAuth();
}

/* ---------- 10. START ---------- */
document.addEventListener("DOMContentLoaded", () => {
  setupSite();
  const page = document.body.dataset.page;
  if (page === "home") setupHome();
  if (page === "list") setupList();
  if (page === "submit") setupSubmit();
  if (page === "obituary") setupObituary();
  if (page === "dashboard") setupDashboard();
  if (page === "admin") setupAdmin();
});