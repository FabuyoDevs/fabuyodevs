/**
 * ==========================================================================
 * FABUYO — Public Site Logic (index.html)
 * --------------------------------------------------------------------------
 *  - Hidden-route redirect (?page=admin → /admin)
 *  - Live portfolio fetching from Cloud Firestore (with demo fallback)
 *  - Client-side search + category filtering
 *  - Lead-capture contact form with validation → Firestore "inquiries"
 *  - UI polish: scroll header, mobile menu, reveals, counters, parallax
 * ==========================================================================
 */

import {
  db,
  isFirebaseConfigured,
  PROJECTS_COLLECTION,
  INQUIRIES_COLLECTION,
  CATEGORIES,
} from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* --------------------------------------------------------------------------
 * 0. HIDDEN ROUTE — the only doorway to the admin portal.
 *    There are intentionally NO visible links to it anywhere in the UI.
 * -------------------------------------------------------------------------- */
if (new URLSearchParams(window.location.search).get("page") === "admin") {
  window.location.replace("/admin");
}

/* --------------------------------------------------------------------------
 * 1. DEMO DATA — shown only while Firebase placeholders are untouched,
 *    so the public site is fully presentable before credentials are set.
 * -------------------------------------------------------------------------- */
const now = Date.now();
const DEMO_PROJECTS = [
  {
    id: "demo-1",
    title: "Velvet Muse Boutique",
    category: "E-commerce",
    description:
      "A conversion-focused fashion storefront with lookbooks, size guides and a one-page checkout that lifted sales by 64%.",
    liveUrl: "https://example.com/velvet-muse",
    imageUrl:
      "https://images.pexels.com/photos/8311880/pexels-photo-8311880.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    createdAt: now - 86400000 * 2,
  },
  {
    id: "demo-2",
    title: "Meridian Capital Group",
    category: "Corporate",
    description:
      "Investor-ready corporate platform with gated reports, press room and multilingual support for a finance consultancy.",
    liveUrl: "https://example.com/meridian",
    imageUrl:
      "https://images.pexels.com/photos/1313534/pexels-photo-1313534.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    createdAt: now - 86400000 * 5,
  },
  {
    id: "demo-3",
    title: "Ember & Oak Café",
    category: "Service",
    description:
      "Neighbourhood café with online table booking, seasonal menu CMS and click-to-call ordering integrated with WhatsApp.",
    liveUrl: "https://example.com/ember-oak",
    imageUrl:
      "https://images.pexels.com/photos/37838325/pexels-photo-37838325.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    createdAt: now - 86400000 * 9,
  },
  {
    id: "demo-4",
    title: "Studio Kobra",
    category: "Creative",
    description:
      "Award-chasing portfolio for a motion-design studio — immersive WebGL transitions, case-study engine and showreel hub.",
    liveUrl: "https://example.com/kobra",
    imageUrl:
      "https://images.pexels.com/photos/20043053/pexels-photo-20043053.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    createdAt: now - 86400000 * 14,
  },
  {
    id: "demo-5",
    title: "Atelier Nord",
    category: "E-commerce",
    description:
      "Minimal Scandinavian homeware shop with curated collections, stock-aware variants and abandoned-cart email flows.",
    liveUrl: "https://example.com/atelier-nord",
    imageUrl:
      "https://images.pexels.com/photos/8311890/pexels-photo-8311890.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    createdAt: now - 86400000 * 21,
  },
  {
    id: "demo-6",
    title: "Harborline Legal",
    category: "Corporate",
    description:
      "Trust-first website for a maritime law firm: attorney profiles, secure client intake forms and resource library.",
    liveUrl: "https://example.com/harborline",
    imageUrl:
      "https://images.pexels.com/photos/31715450/pexels-photo-31715450.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    createdAt: now - 86400000 * 30,
  },
  {
    id: "demo-7",
    title: "Pulse Physio Clinic",
    category: "Service",
    description:
      "Patient-first clinic site with real-time appointment scheduling, treatment guides and automated SMS reminders.",
    liveUrl: "https://example.com/pulse-physio",
    imageUrl:
      "https://images.pexels.com/photos/28448359/pexels-photo-28448359.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    createdAt: now - 86400000 * 40,
  },
  {
    id: "demo-8",
    title: "Noir Frame Photography",
    category: "Creative",
    description:
      "Full-screen gallery experience for a wedding photographer with client proofing rooms and print-store upsells.",
    liveUrl: "https://example.com/noir-frame",
    imageUrl:
      "https://images.pexels.com/photos/11992763/pexels-photo-11992763.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    createdAt: now - 86400000 * 55,
  },
];

/* --------------------------------------------------------------------------
 * 2. STATE + DOM REFERENCES
 * -------------------------------------------------------------------------- */
const state = {
  projects: [],      // all fetched projects
  filter: "All",     // active category
  query: "",         // search string (title)
};

const grid = document.getElementById("workGrid");
const filterBar = document.getElementById("filterBar");
const searchInput = document.getElementById("searchInput");
const workNote = document.getElementById("workNote");

/* --------------------------------------------------------------------------
 * 3. PORTFOLIO — Fetch, Render, Filter
 * -------------------------------------------------------------------------- */

/** Normalize a Firestore Timestamp | number | Date → milliseconds. */
const toMillis = (v) =>
  v?.toMillis?.() ?? (v instanceof Date ? v.getTime() : Number(v) || 0);

/** Escape user-entered strings before injecting into HTML. */
const escapeHTML = (str = "") =>
  String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

/** Build the filter pill buttons from the canonical category list. */
function renderFilters() {
  const all = ["All", ...CATEGORIES];
  filterBar.innerHTML = all
    .map(
      (cat) => `
      <button class="filter-btn ${cat === state.filter ? "active" : ""}"
              data-filter="${cat}" aria-pressed="${cat === state.filter}">
        ${cat}
      </button>`
    )
    .join("");
}

/** Card template for a single project. */
function projectCard(p, i) {
  return `
    <article class="project-card" style="animation-delay:${Math.min(i * 70, 420)}ms">
      <div class="pc-media">
        <span class="badge pc-badge">${escapeHTML(p.category)}</span>
        <img src="${escapeHTML(p.imageUrl)}" alt="${escapeHTML(p.title)} — project screenshot"
             loading="lazy" decoding="async"
             onerror="this.closest('.pc-media').classList.add('broken'); this.remove();" />
      </div>
      <div class="pc-body">
        <h3>${escapeHTML(p.title)}</h3>
        <p>${escapeHTML(p.description)}</p>
        <div class="pc-foot">
          <small>Fabuyo · ${escapeHTML(p.category)}</small>
          <a class="pc-link" href="${escapeHTML(p.liveUrl)}" target="_blank" rel="noopener noreferrer">
            Live preview <i data-lucide="arrow-up-right"></i>
          </a>
        </div>
      </div>
    </article>`;
}

/** Apply search + category filter and paint the grid. */
function renderProjects() {
  const q = state.query.trim().toLowerCase();

  const visible = state.projects
    .slice()
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .filter((p) => (state.filter === "All" ? true : p.category === state.filter))
    .filter((p) => (q ? p.title.toLowerCase().includes(q) : true));

  if (!visible.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <i data-lucide="folder-search"></i>
        <h3>No projects found</h3>
        <p>Try a different search term or category filter.</p>
      </div>`;
  } else {
    grid.innerHTML = visible.map(projectCard).join("");
  }

  lucide.createIcons(); // re-render icons injected above
}

/** Show shimmering placeholder cards while data loads. */
function renderSkeleton() {
  grid.innerHTML = Array.from({ length: 6 })
    .map(
      () => `
      <div class="skeleton-card">
        <div class="sk sk-media"></div>
        <div class="sk sk-line"></div>
        <div class="sk sk-line short"></div>
      </div>`
    )
    .join("");
}

/** Load projects from Firestore; fall back to demo data when needed. */
async function loadProjects() {
  renderSkeleton();

  if (!isFirebaseConfigured) {
    state.projects = DEMO_PROJECTS;
    if (workNote) workNote.hidden = false; // subtle demo-mode note
    renderProjects();
    return;
  }

  try {
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      orderBy("createdAt", "desc"),
      limit(48)
    );
    const snap = await getDocs(q);
    state.projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // First-run convenience: seed the grid with demos if DB is empty
    if (!state.projects.length) {
      state.projects = DEMO_PROJECTS;
      if (workNote) {
        workNote.hidden = false;
        workNote.textContent =
          "Your Firestore collection is empty — showcasing demo work until you publish projects from your dashboard.";
      }
    } else if (workNote) {
      workNote.hidden = true;
    }
    renderProjects();
  } catch (err) {
    console.error("[Fabuyo] Firestore load failed:", err);
    state.projects = DEMO_PROJECTS;
    if (workNote) {
      workNote.hidden = false;
      workNote.textContent =
        "Live data unavailable right now — showcasing demo work instead.";
    }
    renderProjects();
    toast("Could not reach the live gallery — showing demo work.", "info");
  }
}

/* Filter + search events */
filterBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  state.filter = btn.dataset.filter;
  filterBar
    .querySelectorAll(".filter-btn")
    .forEach((b) => {
      const on = b === btn;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
  renderProjects();
});

let searchTimer;
searchInput.addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = e.target.value;
    renderProjects();
  }, 160); // light debounce
});

/* --------------------------------------------------------------------------
 * 4. CONTACT FORM — validation + Firestore lead capture
 * -------------------------------------------------------------------------- */
const form = document.getElementById("contactForm");
const successPanel = document.getElementById("formSuccess");
const submitBtn = document.getElementById("cfSubmit");

const field = (id) => document.getElementById(id);

/** Toggle the error state of a .field wrapper. */
function setError(input, message) {
  const wrap = input.closest(".field");
  wrap.classList.toggle("error", Boolean(message));
  const label = wrap.querySelector(".error-text");
  if (label && message) label.textContent = message;
}

/** Full client-side validation — returns true when clean. */
function validateForm() {
  let ok = true;
  const name = field("cf-name");
  const email = field("cf-email");
  const message = field("cf-message");

  if (name.value.trim().length < 2) { setError(name, "Please enter your name."); ok = false; }
  else setError(name);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
    setError(email, "Please enter a valid email address."); ok = false;
  } else setError(email);

  if (message.value.trim().length < 10) {
    setError(message, "Tell us a little more (min. 10 characters)."); ok = false;
  } else setError(message);

  return ok;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const original = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Sending…`;

  const payload = {
    name: field("cf-name").value.trim(),
    email: field("cf-email").value.trim(),
    company: field("cf-company").value.trim(),
    service: field("cf-service").value,
    budget: field("cf-budget").value,
    message: field("cf-message").value.trim(),
    status: "new",
    createdAt: serverTimestamp ? serverTimestamp() : new Date(),
  };

  try {
    if (isFirebaseConfigured) {
      await addDoc(collection(db, INQUIRIES_COLLECTION), payload);
    } else {
      await new Promise((r) => setTimeout(r, 900)); // demo latency
      console.info("[Fabuyo] Demo mode — inquiry captured locally:", payload);
    }
    successPanel.classList.add("show");
    lucide.createIcons();
    form.reset();
  } catch (err) {
    console.error("[Fabuyo] Inquiry failed:", err);
    toast("Something went wrong sending your message. Please email us directly.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = original;
    lucide.createIcons();
  }
});

/* Live re-validation while typing in a field with an error */
form.addEventListener("input", (e) => {
  if (e.target.closest(".field.error")) validateForm();
});

document.getElementById("cfAgain").addEventListener("click", () => {
  successPanel.classList.remove("show");
  field("cf-name").focus();
});

/* --------------------------------------------------------------------------
 * 5. TOASTS (shared tiny helper, also used on error paths)
 * -------------------------------------------------------------------------- */
const toastWrap = document.getElementById("toasts");
function toast(message, type = "info") {
  const icons = { success: "check-circle-2", error: "alert-circle", info: "info" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<i data-lucide="${icons[type] || "info"}"></i><div>${escapeHTML(message)}</div>`;
  toastWrap.appendChild(el);
  lucide.createIcons();
  setTimeout(() => {
    el.classList.add("out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 4200);
}

/* --------------------------------------------------------------------------
 * 6. SITE CHROME — header, menu, reveals, counters, spotlight, parallax
 * -------------------------------------------------------------------------- */

/* Sticky header state */
const header = document.getElementById("siteHeader");
addEventListener("scroll", () => header.classList.toggle("scrolled", scrollY > 12), {
  passive: true,
});

/* Mobile menu */
const burger = document.getElementById("burger");
const mobileMenu = document.getElementById("mobileMenu");
burger.addEventListener("click", () => {
  const open = mobileMenu.classList.toggle("open");
  burger.classList.toggle("open", open);
  burger.setAttribute("aria-expanded", open);
  document.body.style.overflow = open ? "hidden" : "";
});
mobileMenu.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    mobileMenu.classList.remove("open");
    burger.classList.remove("open");
    document.body.style.overflow = "";
  })
);

/* Scrollspy for nav underline */
const spyLinks = [...document.querySelectorAll(".nav-links a[href^='#']")];
const spySections = spyLinks
  .map((a) => document.querySelector(a.getAttribute("href")))
  .filter(Boolean);
addEventListener(
  "scroll",
  () => {
    const pos = scrollY + innerHeight * 0.32;
    let current = null;
    for (const sec of spySections) if (sec.offsetTop <= pos) current = sec.id;
    spyLinks.forEach((a) =>
      a.classList.toggle("active", a.getAttribute("href") === `#${current}`)
    );
  },
  { passive: true }
);

/* Reveal-on-scroll */
const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    }),
  { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* Animated stat counters */
const counterIO = new IntersectionObserver(
  (entries) =>
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      counterIO.unobserve(el);
      const target = parseFloat(el.dataset.count);
      const decimals = (el.dataset.count.split(".")[1] || "").length;
      const t0 = performance.now();
      const dur = 1600;
      (function tick(t) {
        const k = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - k, 3);
        el.firstChild.textContent = (target * eased).toFixed(decimals);
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    }),
  { threshold: 0.6 }
);
document.querySelectorAll("[data-count]").forEach((el) => counterIO.observe(el));

/* Cursor spotlight on service cards */
document.querySelectorAll(".service-card").forEach((card) =>
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  })
);

/* Hero parallax — cards drift gently against the cursor */
const stage = document.getElementById("hvStage");
if (stage && matchMedia("(pointer:fine)").matches) {
  const layers = stage.querySelectorAll("[data-depth]");
  let tx = 0, ty = 0, cx = 0, cy = 0;
  addEventListener("pointermove", (e) => {
    tx = e.clientX / innerWidth - 0.5;
    ty = e.clientY / innerHeight - 0.5;
  });
  (function raf() {
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    layers.forEach((l) => {
      const d = parseFloat(l.dataset.depth);
      l.style.translate = `${cx * d * 42}px ${cy * d * 42}px`;
    });
    requestAnimationFrame(raf);
  })();
}

/* Footer year */
document.getElementById("year").textContent = new Date().getFullYear();

/* --------------------------------------------------------------------------
 * 7. BOOT
 * -------------------------------------------------------------------------- */
renderFilters();
loadProjects();
lucide.createIcons();
