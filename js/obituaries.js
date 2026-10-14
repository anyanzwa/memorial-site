/* ==========================================================================
   Everlight Memorials — Obituaries page
   ========================================================================== */

/* --------------------------------------------------------------------------
   Sample data
   --------------------------------------------------------------------------
   Replace this array with your own obituaries. Each entry needs:
     id      → unique slug (used in the URL to the detail page)
     name    → full name
     born    → birth year (string)
     died    → date of passing (YYYY-MM-DD)
     age     → age at passing
     county  → home county
     summary → one-sentence life summary
     photo   → (optional) path to a portrait image; leave "" for initials
   -------------------------------------------------------------------------- */
const OBITUARIES = [
  {
    id: "grace-wanjiku-2019",
    name: "Grace Wanjiku Kamau",
    born: "1943",
    died: "2019-08-14",
    age: 76,
    county: "Nairobi",
    summary: "A devoted teacher, mother of five, and pillar of her church community in Kasarani for over four decades.",
    photo: ""
  },
  {
    id: "peter-otieno-2020",
    name: "Peter Ochieng Otieno",
    born: "1958",
    died: "2020-03-02",
    age: 62,
    county: "Kisumu",
    summary: "A fisherman and storyteller whose laughter filled the shores of Lake Victoria for six decades.",
    photo: ""
  },
  {
    id: "esther-mwikali-2021",
    name: "Esther Mwikali Mutua",
    born: "1935",
    died: "2021-11-19",
    age: 86,
    county: "Machakos",
    summary: "Grandmother, farmer, and keeper of family history. She raised three generations under one roof.",
    photo: ""
  },
  {
    id: "james-kiprop-2022",
    name: "James Kiprop Bett",
    born: "1970",
    died: "2022-06-08",
    age: 52,
    county: "Uasin Gishu",
    summary: "A teacher, mentor, and marathon runner who believed every child deserved a chance to learn.",
    photo: ""
  },
  {
    id: "mary-akinyi-2022",
    name: "Mary Atieno Akinyi",
    born: "1949",
    died: "2022-09-27",
    age: 73,
    county: "Siaya",
    summary: "A nurse who served her community for over thirty years with quiet devotion and endless patience.",
    photo: ""
  },
  {
    id: "david-mwangi-2023",
    name: "David Njenga Mwangi",
    born: "1962",
    died: "2023-01-15",
    age: 60,
    county: "Kiambu",
    summary: "Carpenter, father, and friend to many. He built homes, and he built people.",
    photo: ""
  },
  {
    id: "catherine-moraa-2023",
    name: "Catherine Nyaboke Moraa",
    born: "1955",
    died: "2023-04-22",
    age: 67,
    county: "Kisii",
    summary: "A singer in the church choir for fifty years, whose voice carried comfort to everyone who heard it.",
    photo: ""
  },
  {
    id: "joseph-mutiso-2024",
    name: "Joseph Musyoka Mutiso",
    born: "1940",
    died: "2024-02-11",
    age: 83,
    county: "Kitui",
    summary: "A retired chief whose wisdom guided his village through decades of change with steady grace.",
    photo: ""
  },
  {
    id: "fatuma-hassan-2024",
    name: "Fatuma Aisha Hassan",
    born: "1968",
    died: "2024-07-03",
    age: 56,
    county: "Mombasa",
    summary: "Entrepreneur, mother, and community organiser who believed in the power of small kindnesses.",
    photo: ""
  }
];

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const initials = n => n
  .split(' ').filter(Boolean).slice(0, 2)
  .map(w => w[0]).join('').toUpperCase();

/* --------------------------------------------------------------------------
   Card template
   -------------------------------------------------------------------------- */
const cardHTML = (o, i) => {
  const delay = Math.min(i * 70, 560);
  const photo = o.photo
    ? `<img src="${esc(o.photo)}" alt="Portrait of ${esc(o.name)}" loading="lazy">`
    : ``;

  return `
    <a class="ob-card" href="obituary.html?id=${encodeURIComponent(o.id)}"
       style="animation-delay: ${delay}ms">
      <div class="ob-photo">
        ${photo}
        ${!o.photo ? `<span class="initials">${initials(o.name)}</span>` : ''}
        <span class="ribbon">In Memoriam</span>
        <span class="county-tag">${esc(o.county)} County</span>
      </div>
      <div class="ob-body">
        <h3 class="ob-name">${esc(o.name)}</h3>
        <div class="ob-dates">
          <span>${esc(o.born)}</span>
          <span class="sep"></span>
          <span>${new Date(o.died).getFullYear()}</span>
          <span class="sep"></span>
          <span>Age ${o.age}</span>
        </div>
        <p class="ob-summary">${esc(o.summary)}</p>
        <div class="ob-footer">
          <span class="ob-cta">View memorial</span>
        </div>
      </div>
    </a>`;
};

/* --------------------------------------------------------------------------
   Obituaries page init
   -------------------------------------------------------------------------- */
function initObituariesPage() {
  const grid     = $('#list');
  const q        = $('#q');
  const county   = $('#county');
  const countEl  = $('#count');
  const clearBtn = $('#clear');

  if (!grid) return;

  // Populate county dropdown from the data
  [...new Set(OBITUARIES.map(o => o.county))].sort()
    .forEach(c => county.add(new Option(c, c)));

  // Render
  const render = () => {
    const term = q.value.trim().toLowerCase();
    const cty  = county.value;

    const results = OBITUARIES.filter(o => {
      const matchCounty = !cty || o.county === cty;
      const matchTerm =
        !term ||
        o.name.toLowerCase().includes(term) ||
        o.summary.toLowerCase().includes(term) ||
        o.county.toLowerCase().includes(term);
      return matchCounty && matchTerm;
    });

    // Update the count line
    countEl.innerHTML = results.length === 1
      ? `<strong>1</strong> obituary found`
      : `<strong>${results.length}</strong> obituaries found`;

    // Render the grid (or empty state)
    grid.innerHTML = results.length
      ? results.map(cardHTML).join('')
      : `
        <div class="empty">
          <div class="empty-icon">🕊️</div>
          <h3>No obituaries found</h3>
          <p>Try a different name or clear your filters to see everyone.</p>
          <button class="clear-btn" id="clearEmpty">Clear filters</button>
        </div>`;

    // Wire the empty-state clear button
    const emptyClear = $('#clearEmpty');
    if (emptyClear) emptyClear.addEventListener('click', clearFilters);
  };

  const clearFilters = () => {
    q.value = '';
    county.value = '';
    render();
    q.focus();
  };

  // Events
  q.addEventListener('input', render);
  county.addEventListener('change', render);
  clearBtn.addEventListener('click', clearFilters);

  // First render
  render();
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // Footer year
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile menu
  const toggle = $('.menu-toggle');
  const nav    = $('.nav-links');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
  }

  // Obituaries page
  initObituariesPage();
});