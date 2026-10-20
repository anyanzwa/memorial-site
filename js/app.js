/* =====================================================================
   Tribute Hub: app.js (Supabase Version)
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
  
  const { data, error } = await db.storage
    .from('memorial-assets')
    .upload(fileName, file);

  if (error) {
    console.error("Upload error:", error);
    return "";
  }

  const { data: publicURLData } = db.storage
    .from('memorial-assets')
    .getPublicUrl(fileName);

  return publicURLData.publicUrl;
}

/* ---------- 2. OBITUARY CARD ---------- */
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

/* ---------- 2b. CARD EFFECTS ---------- */
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

  cards.forEach((card) => {
    card.classList.add("waiting");
    watcher.observe(card);
  });

  if (!window.matchMedia("(hover: hover)").matches) return;

  cards.forEach((card) => {
    card.addEventListener("mousemove", (event) => {
      const box = card.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      card.style.setProperty("--ry", (x - 0.5) * 14 + "deg");
      card.style.setProperty("--rx", (0.5 - y) * 14 + "deg");
      card.style.setProperty("--mx", x * 100 + "%");
      card.style.setProperty("--my", y * 100 + "%");
    });
    card.addEventListener("mouseleave", () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });
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
  if (button && menu) {
    button.addEventListener("click", () => menu.classList.toggle("open"));
  }
}

/* ---------- 4. HOME PAGE ---------- */
async function setupHome() {
  const recent = $("#recent");
  const recent2 = $("#recent-2");
  
  if (recent) recent.innerHTML = "<p class='small center'>Loading...</p>";
  if (recent2) recent2.innerHTML = "<p class='small center'>Loading...</p>";

  const { data: all, error } = await db
    .from('obituaries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching obituaries:", error);
    if (recent) recent.innerHTML = "<p class='small center'>Could not load data.</p>";
    return;
  }

  if (recent) {
    recent.innerHTML = all.slice(0, 4).map(cardHTML).join("");
    cardEffects(recent);
  }

  if (recent2) {
    recent2.innerHTML = all.slice(4, 8).map(cardHTML).join("");
    cardEffects(recent2);
  }

  revealOnScroll(document.querySelectorAll(".service"));

  const slides = document.querySelectorAll(".slide");
  const dots = document.querySelectorAll(".dots button");
  let current = 0;

  if (slides.length > 0) {
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
}

/* ---------- 5. OBITUARIES PAGE ---------- */
async function setupList() {
  const list = $("#list");
  const search = $("#q");
  const county = $("#county");
  if (!list) return;

  list.innerHTML = "<p class='small center'>Loading obituaries...</p>";

  const { data: all, error } = await db
    .from('obituaries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = "<p class='small center'>Could not load data.</p>";
    return;
  }

  const counties = [...new Set(all.map((o) => o.county))].sort();
  counties.forEach((c) => { if(c) county.add(new Option(c, c)); });

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
    cardEffects(list);
  }

  search.addEventListener("input", show);
  county.addEventListener("change", show);
  $("#clear").addEventListener("click", () => { search.value = ""; county.value = ""; show(); });
  show();
}

/* ---------- 6. FORM CHECKING ---------- */
function checkFields(fields) {
  let ok = true;
  fields.forEach((field) => {
    const error = field.parentElement.querySelector(".error");
    let message = "";
    if (field.required && field.value.trim() === "") message = "This field is required.";
    else if (field.type === "email" && field.value && !/^\S+@\S+\.\S+$/.test(field.value)) message = "Enter a valid email.";
    else if (field.type === "tel" && field.value && !/^[+\d\s-]{9,15}$/.test(field.value)) message = "Enter a valid phone number.";
    if (error) error.textContent = message;
    field.classList.toggle("bad", message !== "");
    if (message) ok = false;
  });
  return ok;
}

/* ---------- 7. SUBMIT PAGE ---------- */
let pendingObituary = null;
let pendingFiles = { photo: null, gallery: [], program: null };

function setupSubmit() {
  const form = $("#submit-form");
  if (!form) return;
  const get = (id) => $("#" + id);

  function updatePreview() {
    const name = get("name").value.trim() || "Full name";
    const born = get("born").value.slice(0, 4) || "????";
    const died = get("died").value.slice(0, 4) || "????";
    $("#pv-init").textContent = initials(name);
    $("#pv-name").textContent = name;
    $("#pv-dates").textContent = born + " – " + died;
    $("#pv-story").textContent = get("story").value.slice(0, 120) || "A short life story will appear here.";
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
    if (get("phone")?.value && !checkFields([get("phone")])) return;

    pendingFiles.photo = get("photo").files[0];
    pendingFiles.gallery = Array.from(get("gallery").files);
    pendingFiles.program = get("program").files[0];

    const born = get("born").value.slice(0, 4);
    const died = get("died").value;
    const story = get("story").value.trim();
    const securePin = Math.floor(1000 + Math.random() * 9000).toString();

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
      secure_pin: securePin,
      family_email: get("email").value.trim(),
      family_phone: get("phone")?.value.trim() || ""
    };

    $("#prev-name").textContent = pendingObituary.name;
    $("#prev-born").textContent = pendingObituary.born;
    $("#prev-died").textContent = pendingObituary.died.slice(0, 4);
    $("#prev-summary").textContent = pendingObituary.summary;
    $("#prev-county").textContent = pendingObituary.county;
    
    const storyHTML = pendingObituary.story.split(/\n+/).filter(Boolean).map((text) => `<p>${safe(text)}</p>`).join("");
    $("#prev-story").innerHTML = storyHTML;

    if (pendingFiles.photo) {
      const photoUrl = URL.createObjectURL(pendingFiles.photo);
      $("#prev-portrait").innerHTML = `<img src="${photoUrl}" alt="Photo">`;
      $("#prev-bg").style.backgroundImage = `url("${photoUrl}")`;
    } else {
      $("#prev-portrait").textContent = initials(pendingObituary.name);
      $("#prev-bg").style.backgroundImage = 'none';
    }

    if (pendingFiles.gallery.length > 0) {
      $("#prev-gallery-section").style.display = "block";
      $("#prev-gallery").innerHTML = pendingFiles.gallery.map(file => `<img src="${URL.createObjectURL(file)}" alt="Gallery Photo">`).join("");
    } else {
      $("#prev-gallery-section").style.display = "none";
    }

    let funeralHTML = "";
    if (pendingObituary.service || pendingObituary.burial) {
      funeralHTML += `<h2 class="ornate">Funeral details</h2><div class="details">`;
      if (pendingObituary.service) funeralHTML += `<div class="detail"><b>Memorial service</b><p>${safe(pendingObituary.service)}</p></div>`;
      if (pendingObituary.burial) funeralHTML += `<div class="detail"><b>Burial</b><p>${safe(pendingObituary.burial)}</p></div>`;
      funeralHTML += `</div>`;
    }
    $("#prev-funeral-details").innerHTML = funeralHTML;

    if (pendingObituary.fund_target > 0) {
      $("#prev-contribution-box").style.display = "block";
      $("#prev-fund-reason").textContent = pendingObituary.fund_reason || "Help the family with funeral expenses.";
      $("#prev-fund-target").textContent = Number(pendingObituary.fund_target).toLocaleString();
    } else {
      $("#prev-contribution-box").style.display = "none";
    }

    document.getElementById("form-section").style.display = "none";
    document.getElementById("preview-section").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.getElementById("back-to-edit").addEventListener("click", () => {
    document.getElementById("preview-section").style.display = "none";
    document.getElementById("form-section").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.getElementById("proceed-to-payment").addEventListener("click", () => {
    $("#publish-modal").hidden = false;
    document.body.style.overflow = 'hidden';
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const payBtn = $("#pay-publish-btn");
  const closeBtn = $("#close-publish-modal");

  if (payBtn) {
    payBtn.addEventListener("click", async () => {
      if (!pendingObituary) return;
      payBtn.textContent = 'Processing Payment...';
      payBtn.disabled = true;

      setTimeout(async () => {
        payBtn.textContent = 'Uploading Files...';
        
        const photoUrl = await uploadFile(pendingFiles.photo, 'photos');
        
        let galleryUrls = [];
        for (const file of pendingFiles.gallery) {
          const url = await uploadFile(file, 'gallery');
          if (url) galleryUrls.push(url);
        }
        
        const programUrl = await uploadFile(pendingFiles.program, 'programs');

        pendingObituary.photo_url = photoUrl;
        pendingObituary.gallery_urls = galleryUrls;
        pendingObituary.program_url = programUrl;

        const { data, error } = await db
          .from('obituaries')
          .insert([pendingObituary])
          .select();

        if (error) {
          alert("Database Error: " + error.message);
          payBtn.textContent = 'Pay via M-Pesa';
          payBtn.disabled = false;
          return;
        }

        const newId = data[0].id;

        const reviewHTML = `
          <div style="background: #fff; padding: 12px; border: 1px solid var(--line); border-radius: 6px;">
            <strong style="color: var(--gold); display: block; font-size: 0.8rem; text-transform: uppercase;">Deceased Details</strong>
            <span style="font-size: 1.1rem; font-weight: 700;">${safe(pendingObituary.name)}</span><br>
            <span class="small">${pendingObituary.born} – ${pendingObituary.died} | ${safe(pendingObituary.county)} County</span>
          </div>
          <div style="background: #fff; padding: 12px; border: 1px solid var(--line); border-radius: 6px;">
            <strong style="color: var(--gold); display: block; font-size: 0.8rem; text-transform: uppercase;">Added Features</strong>
            <span class="small">
              ${pendingObituary.fund_target > 0 ? '✅ Fundraising<br>' : '❌ No Fundraising<br>'}
              ${pendingObituary.livestream ? '✅ Livestream<br>' : '❌ No Livestream<br>'}
              ${programUrl ? '✅ Program PDF<br>' : '❌ No Program PDF<br>'}
              ${galleryUrls.length > 0 ? '✅ Gallery (' + galleryUrls.length + ')' : '❌ No Gallery'}
            </span>
          </div>
          <div style="background: #fff; padding: 12px; border: 1px solid var(--line); border-radius: 6px; grid-column: 1 / -1;">
            <strong style="color: var(--gold); display: block; font-size: 0.8rem; text-transform: uppercase;">Contact Person</strong>
            <span class="small">${safe(pendingObituary.family_email)} · ${safe(pendingObituary.family_phone || 'No phone')}</span>
          </div>
        `;
        document.getElementById("success-review").innerHTML = reviewHTML;

        $("#publish-modal").hidden = true;
        document.body.style.overflow = '';
        payBtn.textContent = 'Pay via M-Pesa';
        payBtn.disabled = false;

        document.getElementById("preview-section").style.display = "none";
        document.getElementById("success-section").style.display = "block";
        document.getElementById("success-pin").textContent = pendingObituary.secure_pin;
        document.getElementById("success-view-btn").href = `obituary.html?id=${newId}`;
        document.getElementById("success-manage-btn").href = `dashboard.html?id=${newId}`;
        
        window.scrollTo({ top: 0, behavior: "smooth" });
        pendingObituary = null;
        pendingFiles = { photo: null, gallery: [], program: null };
      }, 2000);
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      $("#publish-modal").hidden = true;
      document.body.style.overflow = '';
    });
  }
});

/* ---------- 8. SINGLE OBITUARY PAGE ---------- */
async function setupObituary() {
  const id = new URLSearchParams(location.search).get("id");
  const page = $("#obituary");
  if (!page) return;

  page.innerHTML = "<div class='container section center'><p>Loading memorial...</p></div>";

  const { data: o, error } = await db
    .from('obituaries')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !o) {
    page.innerHTML = '<div class="container section center"><h1>Obituary not found</h1><p><a href="obituaries.html">← Back to all obituaries</a></p></div>';
    return;
  }
  document.title = o.name + " | Tribute Hub";
  
  if ($('#og-title')) $('#og-title').setAttribute('content', `In Loving Memory of ${o.name}`);
  if ($('#og-desc')) $('#og-desc').setAttribute('content', `View the life story of ${o.name} and leave a tribute.`);
  if ($('#og-image') && o.photo_url) $('#og-image').setAttribute('content', o.photo_url);

  function getEmbedUrl(url) {
    if (!url) return "";
    if (url.includes("youtube.com/embed/") || url.includes("youtu.be/")) return url.replace("youtu.be/", "youtube.com/embed/");
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) return `https://www.youtube.com/embed/${match[2]}`;
    return url; 
  }

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

  const livestreamSection = o.livestream ? `
      <h2 class="ornate">Watch the Funeral</h2>
      <p class="small center" style="margin-bottom: 16px;">For those unable to attend in person, the service can be viewed here.</p>
      <div class="livestream-wrapper">
        <iframe src="${getEmbedUrl(o.livestream)}" title="Funeral Livestream" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
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
              <span><strong id="fund-raised">KSh 0</strong> raised</span>
              <span>Target: KSh ${Number(o.fund_target).toLocaleString()}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" id="fund-bar" style="width: 0%"></div></div>
          </div>
          <button class="btn gold" id="btn-contribute" style="width:100%; margin-top: 16px;">Contribute via M-Pesa / Card</button>
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
        <p class="hero-candle">
          <button class="btn gold" id="candle">🕯️ Light a candle</button>
          ${o.livestream ? `<a href="#livestream-section" class="btn outline" style="color:#fff; border-color:#fff; margin-top:8px;">📺 Watch Livestream</a>` : ""}
          <span id="candle-count" class="small"></span>
        </p>
      </div>
    </header>

    <section class="section">
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
          ${contribution}
          <div class="side-box">
            <h3>Share this tribute</h3>
            <button class="btn gold share" id="download-poster" type="button">⬇ Download Announcement Poster</button>
            <a class="btn outline share" id="whatsapp" target="_blank" rel="noopener">Share on WhatsApp</a>
            <button class="btn outline share" id="copy" type="button">Copy link</button>
          </div>
          
          ${localStorage.getItem("my_memorials")?.includes(o.id) ? `
          <div class="side-box" style="background: #faf7f1; border-color: var(--gold);">
            <h3>Family Controls</h3>
            <p class="small" style="margin-bottom: 12px;">You created this page on this device.</p>
            <a href="dashboard.html?id=${encodeURIComponent(o.id)}" class="btn gold" style="width: 100%;">Manage Memorial</a>
          </div>
          ` : ""}
        </aside>
      </div>
    </section>`;

  if (o.photo_url) $("#hero-bg").style.backgroundImage = 'url("' + o.photo_url + '")';

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

  $("#whatsapp").href = "https://wa.me/?text=" + encodeURIComponent("In loving memory of " + o.name + ": " + location.href);
  $("#copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); $("#copy").textContent = "Link copied ✓"; }
    catch (e) { $("#copy").textContent = "Copy the address from your browser"; }
  });

  $("#download-poster").addEventListener("click", () => generatePoster(o));

  async function showTributes() {
    const { data: list, error } = await db
      .from('tributes')
      .select('*')
      .eq('obituary_id', o.id)
      .order('created_at', { ascending: false });

    if (error) return;
    
    $("#comments-title").textContent = "Tributes (" + list.length + ")";
    $("#tributes").innerHTML = list.length
      ? list.map((t) => `
          <div class="comment">
            <div class="c-avatar">${initials(t.name)}</div>
            <div><b>${safe(t.name)}</b> <span class="small">· ${new Date(t.created_at).toLocaleDateString("en-KE")}</span><p>${safe(t.message)}</p></div>
          </div>`).join("")
      : '<p class="small">No tributes yet. Be the first to share a memory.</p>';
  }
  
  $("#tribute-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#t-name");
    const message = $("#t-msg");
    if (!checkFields([name, message])) return;
    
    const btn = event.target.querySelector('button[type="submit"]');
    btn.textContent = "Posting...";
    btn.disabled = true;

    const { error } = await db
      .from('tributes')
      .insert([{ 
        obituary_id: o.id, 
        name: name.value.trim(), 
        message: message.value.trim() 
      }]);

    if (error) {
      alert("Could not post tribute.");
    } else {
      name.value = "";
      message.value = "";
      await showTributes();
    }
    
    btn.textContent = "Post tribute";
    btn.disabled = false;
  });
  
  showTributes();

  if (hasFundTarget) {
    const updateProgress = () => {
      const raised = Number(localStorage.getItem(`raised_${o.id}`) || 0);
      const pct = Math.min((raised / o.fund_target) * 100, 100);
      if ($("#fund-raised")) $("#fund-raised").textContent = `KSh ${raised.toLocaleString()}`;
      if ($("#fund-bar")) $("#fund-bar").style.width = `${pct}%`;
    };
    updateProgress();

    if ($("#btn-contribute")) {
      $("#btn-contribute").onclick = () => {
        $("#contribute-modal").hidden = false;
        document.body.style.overflow = 'hidden';
      };
      $("#close-modal").onclick = () => {
        $("#contribute-modal").hidden = true;
        document.body.style.overflow = '';
      };
      document.querySelectorAll('.btn-amount').forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll('.btn-amount').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          $("#c-amount").value = btn.dataset.amt;
          $("#pay-amt").textContent = Number(btn.dataset.amt).toLocaleString();
        };
      });
      $("#c-amount").oninput = (e) => {
        $("#pay-amt").textContent = Number(e.target.value || 0).toLocaleString();
      };
      
      $("#contribute-form").onsubmit = async (e) => {
        e.preventDefault();
        const amt = Number($("#c-amount").value);
        const name = $("#c-name").value.trim();
        const phone = $("#c-phone").value.trim();
        const btn = e.target.querySelector('button[type="submit"]');
        
        btn.textContent = 'Processing...';
        btn.disabled = true;
        
        await db.from('donations').insert([{
          obituary_id: o.id,
          donor_name: name || "Anonymous",
          donor_phone: phone,
          amount: amt
        }]);

        setTimeout(() => {
          const current = Number(localStorage.getItem(`raised_${o.id}`) || 0);
          localStorage.setItem(`raised_${o.id}`, current + amt);
          
          updateProgress();
          btn.innerHTML = `Pay KSh 0`;
          btn.disabled = false;
          $("#contribute-form").reset();
          $("#contribute-modal").hidden = true;
          document.body.style.overflow = '';
          
          alert(`Thank you ${name || ''}! Your contribution of KSh ${amt.toLocaleString()} has been recorded.`);
        }, 1500);
      };
    }
  }
}

/* ---------- 8b. ANNOUNCEMENT POSTER GENERATOR ---------- */
function generatePoster(o) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f0ebe1";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#bc7504";
  ctx.lineWidth = 12;
  ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

  ctx.fillStyle = "#4a566b";
  ctx.font = "600 24px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("IN LOVING MEMORY", canvas.width / 2, 130);

  const drawTextAndFinish = (img) => {
    let yOffset = 200;
    
    if (img) {
      const size = 400;
      const x = (canvas.width - size) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 400, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x, 200, size, size);
      ctx.restore();
      
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 400, size / 2 + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#bc7504";
      ctx.lineWidth = 8;
      ctx.stroke();
      
      yOffset = 680;
    } else {
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 400, 200, 0, Math.PI * 2);
      ctx.fillStyle = "#1f2a3d";
      ctx.fill();
      ctx.strokeStyle = "#bc7504";
      ctx.lineWidth = 8;
      ctx.stroke();
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 120px Georgia, serif";
      ctx.fillText(initials(o.name), canvas.width / 2, 440);
      
      yOffset = 680;
    }

    ctx.fillStyle = "#1f2a3d";
    ctx.font = "bold 72px Georgia, serif";
    ctx.fillText(o.name, canvas.width / 2, yOffset);
    yOffset += 70;

    ctx.fillStyle = "#bc7504";
    ctx.font = "600 32px Arial, sans-serif";
    ctx.fillText(`Sunrise: ${o.born}  ✦  Sunset: ${o.died.slice(0, 4)}`, canvas.width / 2, yOffset);
    yOffset += 80;

    const funeralInfo = o.service || o.burial;
    if (funeralInfo) {
      ctx.fillStyle = "#4a566b";
      ctx.font = "400 28px Arial, sans-serif";
      
      const words = funeralInfo.split(" ");
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
    }

    ctx.fillStyle = "#8892a6";
    ctx.font = "600 22px Arial, sans-serif";
    ctx.fillText("TributeHub.com", canvas.width / 2, canvas.height - 100);
    
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

/* ---------- 8c. FAMILY DASHBOARD ---------- */
async function setupDashboard() {
  const loginGate = $("#login-gate");
  const dashboard = $("#dashboard-content");
  const idInput = $("#login-id");
  const pinInput = $("#login-pin");
  const loginBtn = $("#login-btn");
  const errorMsg = $("#login-error");
  
  let currentId = null;
  let currentObituary = null;

  loginBtn.addEventListener("click", async () => {
    const id = idInput.value.trim();
    const pin = pinInput.value.trim();
    
    const { data, error } = await db
      .from('obituaries')
      .select('*')
      .eq('id', id)
      .single();

    if (data && (pin === data.secure_pin)) {
      currentId = id;
      currentObituary = data;
      loginGate.style.display = "none";
      dashboard.style.display = "block";
      await loadDashboardData();
    } else {
      errorMsg.style.display = "block";
    }
  });

  const urlId = new URLSearchParams(location.search).get("id");
  if (urlId) {
    idInput.value = urlId;
    loginGate.style.display = "block";
  }

  $("#logout-btn").addEventListener("click", () => {
    dashboard.style.display = "none";
    loginGate.style.display = "block";
    idInput.value = "";
    pinInput.value = "";
    errorMsg.style.display = "none";
  });

  async function loadDashboardData() {
    $("#dash-name").textContent = currentObituary.name;
    $("#dash-view-link").href = `obituary.html?id=${currentId}`;
    
    const { data: tributes } = await db
      .from('tributes')
      .select('*')
      .eq('obituary_id', currentId)
      .order('created_at', { ascending: false });

    const tribBox = $("#dash-tributes");
    if (!tributes || tributes.length === 0) {
      tribBox.innerHTML = '<p class="small">No tributes yet.</p>';
    } else {
      tribBox.innerHTML = tributes.map((t) => `
        <div style="border-bottom: 1px solid var(--line); padding: 12px 0; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div>
            <b style="font-size: 0.9rem;">${safe(t.name)}</b> <span class="small">· ${new Date(t.created_at).toLocaleDateString("en-KE")}</span>
            <p style="margin: 4px 0 0; font-size: 0.9rem;">${safe(t.message)}</p>
          </div>
          <button class="btn outline" style="padding: 4px 8px; font-size: 0.75rem; color: #b3261e; border-color: #b3261e;" onclick="deleteTribute('${t.id}')">Delete</button>
        </div>
      `).join("");
    }

    const raised = Number(localStorage.getItem(`raised_${currentId}`) || 0);
    $("#dash-raised").textContent = `KSh ${raised.toLocaleString()}`;
  }

  window.deleteTribute = async (tributeId) => {
    if (!confirm("Are you sure you want to hide this tribute?")) return;
    await db.from('tributes').delete().eq('id', tributeId);
    await loadDashboardData();
  };

  $("#download-csv").addEventListener("click", async () => {
    const { data: donations } = await db
      .from('donations')
      .select('*')
      .eq('obituary_id', currentId);

    if (!donations || donations.length === 0) {
      alert("No contributions recorded yet.");
      return;
    }

    let csv = "Date,Donor Name,Phone Number,Amount (KSh)\n";
    donations.forEach(d => {
      csv += `"${new Date(d.created_at).toLocaleDateString("en-KE")}","${d.donor_name}","${d.donor_phone}",${d.amount}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentObituary.name.replace(/\s+/g, '-')}-Contributions.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  });

  const editForm = $("#request-edit-form");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#edit-message").value.trim();
      if (!msg) return;

      await db.from('edit_requests').insert([{
        obituary_id: currentId,
        obituary_name: currentObituary.name,
        message: msg
      }]);

      alert("Your request has been sent to the Admin. They will review and apply the changes shortly.");
      editForm.reset();
    });
  }
}

/* ---------- 8d. ADMIN DASHBOARD ---------- */
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
    const { data: obits } = await db.from('obituaries').select('*').order('created_at', { ascending: false });
    let totalRaised = 0;
    let totalTributes = 0;

    const { data: requests } = await db.from('edit_requests').select('*');
    const alertBanner = $("#admin-alert");
    
    if (requests && requests.length > 0) {
      $("#alert-text").textContent = `You have ${requests.length} pending edit request${requests.length > 1 ? 's' : ''}!`;
      alertBanner.style.display = "flex"; 
    } else {
      alertBanner.style.display = "none"; 
    }

    const tbody = $("#admin-table tbody");
    tbody.innerHTML = "";

    if (obits) {
      for (const o of obits) {
        const { count: tribs } = await db.from('tributes').select('*', { count: 'exact', head: true }).eq('obituary_id', o.id);
        const raised = Number(localStorage.getItem(`raised_${o.id}`) || 0);
        totalRaised += raised;
        totalTributes += (tribs || 0);

        tbody.innerHTML += `
          <tr>
            <td><strong>${safe(o.name)}</strong></td>
            <td>${safe(o.county)}</td>
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

    $("#stat-obits").textContent = obits ? obits.length : 0;
    $("#stat-tributes").textContent = totalTributes;
    $("#stat-raised").textContent = "KSh " + totalRaised.toLocaleString();

    const reqTbody = $("#requests-table tbody");
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
      const raised = Number(localStorage.getItem(`raised_${o.id}`) || 0);
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

  checkAuth();

  setInterval(() => {
    if (localStorage.getItem("admin_auth") === "true") {
      loadAdminData();
    }
  }, 5000);
}

/* ---------- 9. START ---------- */
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