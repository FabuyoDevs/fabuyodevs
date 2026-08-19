/**
 * ==========================================================================
 * FABUYO — Private Admin Portal (admin.html)
 * --------------------------------------------------------------------------
 *  - Session guard via onAuthStateChanged (dashboard stays locked until
 *    Firebase Auth confirms a signed-in admin)
 *  - Email/Password sign-in + secure logout
 *  - Realtime project table (onSnapshot) with client-side search
 *  - Full CRUD: create, edit, delete (Firestore only — images stored as links)
 *  - Screenshot via pasted image URL, or a local file converted into a stored link
 * ==========================================================================
 */

import {
  auth,
  db,
  isFirebaseConfigured,
  PROJECTS_COLLECTION,
  IMAGE_RULES,
  CATEGORIES,
} from "./firebase-config.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";



/* --------------------------------------------------------------------------
 * 1. DOM REFERENCES
 * -------------------------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

const authView = $("authView");
const dashView = $("dashView");
const setupNote = $("setupNote");
const loginForm = $("loginForm");
const loginEmail = $("loginEmail");
const loginPass = $("loginPass");
const loginBtn = $("loginBtn");
const authError = $("authError");

const userEmail = $("userEmail");
const userAvatar = $("userAvatar");
const logoutBtn = $("logoutBtn");

const statTotal = $("statTotal");
const statCats = $("statCats");
const statLatest = $("statLatest");
const tableBody = $("tableBody");
const tableSearch = $("tableSearch");
const tableCount = $("tableCount");
const newProjectBtn = $("newProjectBtn");

const projectOverlay = $("projectOverlay");
const modalTitle = $("modalTitle");
const projectForm = $("projectForm");
const projId = $("projId");
const projTitle = $("projTitle");
const projCategory = $("projCategory");
const projDesc = $("projDesc");
const projUrl = $("projUrl");
const projImage = $("projImage");
const dropzone = $("dropzone");
const fileInput = $("fileInput");
const dzPrompt = $("dzPrompt");
const dzPreview = $("dzPreview");
const dzPreviewImg = $("dzPreviewImg");
const dzRemove = $("dzRemove");
const progressWrap = $("progressWrap");
const progressBar = $("progressBar");
const progressLabel = $("progressLabel");
const saveBtn = $("saveBtn");
const saveBtnLabel = $("saveBtnLabel");
const closeProjectModal = $("closeProjectModal");
const cancelProjectBtn = $("cancelProjectBtn");

const confirmOverlay = $("confirmOverlay");
const confirmTitle = $("confirmTitle");
const confirmCancel = $("confirmCancel");
const confirmDelete = $("confirmDelete");
const closeConfirmModal = $("closeConfirmModal");

const toastsWrap = $("toasts");

/* --------------------------------------------------------------------------
 * 2. STATE
 * -------------------------------------------------------------------------- */
const state = {
  projects: [],        // live Firestore rows
  search: "",          // table filter
  editingId: null,     // doc being edited (null = create)
  editingDraft: null,  // original doc snapshot while editing
  pendingFile: null,   // local file being converted into a stored link
  deleteTarget: null,  // doc queued for deletion
  unsubscribe: null,   // onSnapshot detach fn
  saving: false,
};

/* --------------------------------------------------------------------------
 * 3. UTILITIES
 * -------------------------------------------------------------------------- */
const escapeHTML = (str = "") =>
  String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

const toMillis = (v) =>
  v?.toMillis?.() ?? (v instanceof Date ? v.getTime() : Number(v) || 0);

const fmtDate = (v) => {
  const ms = toMillis(v);
  return ms
    ? new Date(ms).toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      })
    : "—";
};

function toast(message, type = "info") {
  const icons = { success: "check-circle-2", error: "alert-circle", info: "info" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<i data-lucide="${icons[type]}"></i><div>${escapeHTML(message)}</div>`;
  toastsWrap.appendChild(el);
  lucide.createIcons();
  setTimeout(() => {
    el.classList.add("out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 4500);
}

/** Human-friendly Firebase Auth error mapping. */
function authMessage(err) {
  const map = {
    "auth/invalid-credential": "Invalid email or password.",
    "auth/wrong-password": "Invalid email or password.",
    "auth/user-not-found": "No admin account found for that email.",
    "auth/invalid-email": "That email address looks malformed.",
    "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
    "auth/network-request-failed": "Network error — check your connection.",
  };
  return map[err?.code] || "Sign-in failed. Please try again.";
}

function showAuthError(msg) {
  authError.querySelector("span").textContent = msg;
  authError.classList.add("show");
}

/* --------------------------------------------------------------------------
 * 4. AUTH — session guard, sign-in, logout
 * -------------------------------------------------------------------------- */

/** Locked by default: dashboard only renders inside onAuthStateChanged. */
async function enterDashboard(user) {
  try {
    await user.getIdToken(true);
  } catch (err) {
    console.error("[Fabuyo Admin] Session verification failed:", err);
    await signOut(auth);
    return;
  }
  authView.hidden = true;
  authView.inert = true;
  authView.setAttribute("aria-hidden", "true");
  dashView.hidden = false;
  dashView.inert = false;
  dashView.setAttribute("aria-hidden", "false");
  userEmail.textContent = user.email;
  userAvatar.textContent = (user.email || "A").charAt(0);
  subscribeProjects();
}

function leaveDashboard() {
  dashView.hidden = true;
  dashView.inert = true;
  dashView.setAttribute("aria-hidden", "true");
  authView.hidden = false;
  authView.inert = false;
  authView.setAttribute("aria-hidden", "false");
  projectOverlay.classList.remove("open");
  confirmOverlay.classList.remove("open");
  document.body.style.overflow = "";
  if (state.unsubscribe) { state.unsubscribe(); state.unsubscribe = null; }
  state.projects = [];
}

function initAuth() {
  if (!isFirebaseConfigured) {
    setupNote.hidden = false;
    loginBtn.disabled = true;
    loginForm.querySelectorAll("input").forEach((i) => (i.disabled = true));
    return;
  }
  onAuthStateChanged(auth, (user) => (user ? void enterDashboard(user) : leaveDashboard()));
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.remove("show");

  const email = loginEmail.value.trim();
  const password = loginPass.value;
  if (!email || !password) {
    showAuthError("Enter both your admin email and password.");
    return;
  }

  const original = loginBtn.innerHTML;
  loginBtn.disabled = true;
  loginBtn.innerHTML = `<span class="spinner"></span> Verifying…`;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginPass.value = "";
    toast("Welcome back. Session secured.", "success");
  } catch (err) {
    console.warn("[Fabuyo Admin] Auth error:", err.code);
    showAuthError(authMessage(err));
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = original;
    lucide.createIcons();
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    toast("You have been signed out securely.", "info");
  } finally {
    leaveDashboard();
  }
});

/** Guard every write: never touch Firestore without a live session. */
const requireSession = async () => {
  const user = auth?.currentUser;
  if (!user) {
    toast("Session expired — please sign in again.", "error");
    leaveDashboard();
    return null;
  }
  try {
    await user.getIdToken(true);
    return user;
  } catch (err) {
    console.error("[Fabuyo Admin] Session refresh failed:", err);
    await signOut(auth);
    leaveDashboard();
    toast("Session expired — please sign in again.", "error");
    return null;
  }
};

/* --------------------------------------------------------------------------
 * 5. REALTIME PROJECT LIST
 * -------------------------------------------------------------------------- */
function subscribeProjects() {
  if (state.unsubscribe) state.unsubscribe();

  renderRowSkeleton();
  const q = query(collection(db, PROJECTS_COLLECTION), orderBy("createdAt", "desc"));

  state.unsubscribe = onSnapshot(
    q,
    (snap) => {
      const legacyProjects = snap.docs.filter(
        (project) => !Object.prototype.hasOwnProperty.call(project.data(), "published")
      );
      legacyProjects.forEach((project) => {
        updateDoc(doc(db, PROJECTS_COLLECTION, project.id), { published: true })
          .catch((err) => console.error("[Fabuyo Admin] Legacy project migration failed:", err));
      });
      state.projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderStats();
      renderTable();
    },
    (err) => {
      console.error("[Fabuyo Admin] Snapshot error:", err);
      tableBody.innerHTML = "";
      toast("Could not load projects — check your Firestore security rules.", "error");
    }
  );
}

function renderStats() {
  statTotal.textContent = state.projects.length;
  statCats.textContent = new Set(state.projects.map((p) => p.category)).size;
  const latest = state.projects.reduce(
    (max, p) => Math.max(max, toMillis(p.createdAt)), 0
  );
  statLatest.textContent = latest ? fmtDate(latest) : "—";
}

function renderRowSkeleton() {
  tableBody.innerHTML = Array.from({ length: 4 })
    .map(
      () => `<tr class="row-skeleton">
        <td><div class="sk"></div></td><td><div class="sk"></div></td>
        <td><div class="sk"></div></td><td><div class="sk"></div></td>
        <td><div class="sk"></div></td></tr>`
    )
    .join("");
}

function renderTable() {
  const q = state.search.trim().toLowerCase();
  const rows = state.projects.filter(
    (p) =>
      !q ||
      p.title.toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q)
  );

  tableCount.textContent = `${rows.length} / ${state.projects.length}`;

  if (!state.projects.length) {
    tableBody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty-state" style="border:0">
          <i data-lucide="folder-plus"></i>
          <h3>No projects yet</h3>
          <p>Publish your first case study with the “New project” button above.</p>
        </div>
      </td></tr>`;
  } else if (!rows.length) {
    tableBody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty-state" style="border:0">
          <i data-lucide="search-x"></i>
          <h3>No matches</h3>
          <p>No project matches “${escapeHTML(state.search)}”.</p>
        </div>
      </td></tr>`;
  } else {
    tableBody.innerHTML = rows
      .map(
        (p) => `
      <tr data-id="${p.id}">
        <td>
          <div class="cell-title">
            <img class="thumb" src="${escapeHTML(p.imageUrl || "")}" alt=""
                 loading="lazy" onerror="this.style.visibility='hidden'" />
            <div>
              <b>${escapeHTML(p.title)}</b>
              <small>${escapeHTML(p.description || "").slice(0, 64)}…</small>
            </div>
          </div>
        </td>
        <td><span class="badge">${escapeHTML(p.category || "—")}</span></td>
        <td>
          <a class="pc-link" href="${escapeHTML(p.liveUrl || "#")}" target="_blank" rel="noopener">
            Open <i data-lucide="arrow-up-right"></i>
          </a>
        </td>
        <td class="cell-date">${fmtDate(p.createdAt)}</td>
        <td>
          <div class="actions">
            <button class="icon-btn" data-action="edit" title="Edit project" aria-label="Edit ${escapeHTML(p.title)}">
              <i data-lucide="pencil"></i>
            </button>
            <button class="icon-btn danger" data-action="delete" title="Delete project" aria-label="Delete ${escapeHTML(p.title)}">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>`
      )
      .join("");
  }
  lucide.createIcons();
}

tableSearch.addEventListener("input", (e) => {
  state.search = e.target.value;
  renderTable();
});

/* Delegated edit / delete actions */
tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const row = btn.closest("tr[data-id]");
  const project = state.projects.find((p) => p.id === row?.dataset.id);
  if (!project) return;
  btn.dataset.action === "edit" ? openProjectModal(project) : openConfirm(project);
});

/* --------------------------------------------------------------------------
 * 6. PROJECT MODAL — create / edit
 * -------------------------------------------------------------------------- */

/** Populate the category <select> once from the canonical list. */
projCategory.innerHTML =
  `<option value="" disabled selected>Select a category…</option>` +
  CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");

async function openProjectModal(project = null) {
  if (!(await requireSession())) return;

  state.editingId = project?.id ?? null;
  state.editingDraft = project ? { ...project } : null;
  state.pendingFile = null;
  fileInput.value = "";
  projectForm.reset();
  clearErrors();
  hideProgress();

  modalTitle.textContent = project ? "Edit project" : "New project";
  saveBtnLabel.textContent = project ? "Save changes" : "Publish project";

  if (project) {
    projId.value = project.id;
    projTitle.value = project.title || "";
    projCategory.value = project.category || "";
    projDesc.value = project.description || "";
    projUrl.value = project.liveUrl || "";
    projImage.value = project.imageUrl || "";
    if (project.imageUrl) showPreview(project.imageUrl);
    else resetPreview();
  } else {
    projId.value = "";
    projImage.value = "";
    resetPreview();
  }

  projectOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  lucide.createIcons();
  setTimeout(() => projTitle.focus(), 250);
}

function closeProjectModalFn() {
  if (state.saving) return; // never close mid-upload
  projectOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

newProjectBtn.addEventListener("click", () => void openProjectModal());
closeProjectModal.addEventListener("click", closeProjectModalFn);
cancelProjectBtn.addEventListener("click", closeProjectModalFn);
projectOverlay.addEventListener("click", (e) => {
  if (e.target === projectOverlay) closeProjectModalFn();
});

/* --------------------------------------------------------------------------
 * 7. SCREENSHOT LINKS — paste a URL, or convert a local file into a stored link
 *    Nothing is uploaded to Firebase Storage.
 * -------------------------------------------------------------------------- */
function isImageLink(value) {
  const v = (value || "").trim();
  if (!v) return false;
  if (v.startsWith("data:image/")) return true;
  try {
    const u = new URL(v);
    return /^https?:$/.test(u.protocol);
  } catch {
    return false;
  }
}

function showPreview(src) {
  dzPreviewImg.src = src;
  dzPreview.hidden = false;
}
function resetPreview() {
  dzPreviewImg.removeAttribute("src");
  dzPreview.hidden = true;
}

function validateImage(file) {
  const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
  if (!IMAGE_RULES.types.includes(file.type) || !IMAGE_RULES.extensions.includes(ext)) {
    toast("Only .jpg, .png or .webp images are allowed.", "error");
    return false;
  }
  if (file.size > IMAGE_RULES.maxBytes) {
    toast("Image is too large — maximum size is 5 MB.", "error");
    return false;
  }
  return true;
}

function showProgress(pct, label = "Converting screenshot…") {
  progressWrap.hidden = false;
  progressBar.style.width = `${Math.round(pct)}%`;
  progressLabel.textContent = `${label} ${Math.round(pct)}%`;
}
function hideProgress() {
  progressWrap.hidden = true;
  progressBar.style.width = "0%";
}

/**
 * Compress a local image file into a data-URL link that can live in Firestore.
 * Keeps the payload under the 1 MB document limit.
 */
function fileToStoredLink(file) {
  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxW = 1400;
        const scale = Math.min(1, maxW / img.naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(blobUrl);

        let quality = 0.74;
        let data = canvas.toDataURL("image/jpeg", quality);
        while (data.length > 700000 && quality > 0.38) {
          quality -= 0.08;
          data = canvas.toDataURL("image/jpeg", quality);
        }
        if (data.length > 900000) {
          reject(new Error("compressed-too-large"));
          return;
        }
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("decode-failed"));
    };
    img.src = blobUrl;
  });
}

async function handleFile(file) {
  if (!file || !validateImage(file)) return;
  state.pendingFile = file;
  showProgress(20, "Converting screenshot…");
  try {
    const link = await fileToStoredLink(file);
    showProgress(100, "Converted");
    projImage.value = link;
    showPreview(link);
    toast("Image converted to a stored link. Publish to save it.", "success");
  } catch (err) {
    console.error("[Fabuyo Admin] Convert failed:", err);
    toast(
      err?.message === "compressed-too-large"
        ? "That file is still too heavy after compression. Host it (Imgur, Cloudinary, Drive) and paste the image URL instead."
        : "Could not convert that file. Paste an image URL instead.",
      "error"
    );
    state.pendingFile = null;
    fileInput.value = "";
  } finally {
    hideProgress();
  }
}

fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

["dragover", "dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.toggle("drag", evt === "dragover");
    if (evt === "drop") handleFile(e.dataTransfer.files[0]);
  })
);

dzRemove.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  state.pendingFile = null;
  fileInput.value = "";
  projImage.value = "";
  if (state.editingDraft) state.editingDraft.imageUrl = "";
  resetPreview();
});

/* Live preview when a URL is typed or pasted */
let previewTimer;
projImage.addEventListener("input", () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const value = projImage.value.trim();
    if (isImageLink(value)) showPreview(value);
    else resetPreview();
  }, 250);
});
projImage.addEventListener("blur", () => {
  const value = projImage.value.trim();
  if (isImageLink(value)) showPreview(value);
});

/* --------------------------------------------------------------------------
 * 8. SAVE (create / update)
 * -------------------------------------------------------------------------- */
const setFieldError = (input, message) => {
  const wrap = input.closest(".field");
  wrap.classList.toggle("error", Boolean(message));
  const t = wrap.querySelector(".error-text");
  if (t && message) t.textContent = message;
};
const clearErrors = () =>
  projectForm.querySelectorAll(".field.error").forEach((f) => f.classList.remove("error"));

function validateProjectForm() {
  let ok = true;
  if (projTitle.value.trim().length < 3) {
    setFieldError(projTitle, "Give the project a title (min. 3 characters)."); ok = false;
  }
  if (!projCategory.value) { setFieldError(projCategory, "Pick a category."); ok = false; }
  if (projDesc.value.trim().length < 10) {
    setFieldError(projDesc, "Describe the project (min. 10 characters)."); ok = false;
  }
  try {
    const u = new URL(projUrl.value.trim());
    if (!/^https?:$/.test(u.protocol)) throw new Error();
  } catch {
    setFieldError(projUrl, "Enter a full URL, e.g. https://client-site.com"); ok = false;
  }
  if (!isImageLink(projImage.value)) {
    setFieldError(projImage, "Paste an image URL, or convert a local file below."); ok = false;
  }
  return ok;
}

projectForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (state.saving || !(await requireSession())) return;
  clearErrors();
  if (!validateProjectForm()) return;

  state.saving = true;
  saveBtn.disabled = true;
  saveBtnLabel.textContent = "Working…";

  try {
    saveBtnLabel.textContent = "Saving…";
    const payload = {
      title: projTitle.value.trim(),
      category: projCategory.value,
      description: projDesc.value.trim(),
      liveUrl: projUrl.value.trim(),
      imageUrl: projImage.value.trim(),
      published: state.editingDraft?.published ?? true,
      updatedAt: serverTimestamp(),
    };

    if (state.editingId) {
      await updateDoc(doc(db, PROJECTS_COLLECTION, state.editingId), payload);
      toast("Project updated successfully.", "success");
    } else {
      await addDoc(collection(db, PROJECTS_COLLECTION), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      toast("Project published to your live portfolio.", "success");
    }

    closeProjectModalFn();
  } catch (err) {
    console.error("[Fabuyo Admin] Save failed:", err);
    toast("Could not save the project — check Firestore rules.", "error");
  } finally {
    state.saving = false;
    saveBtn.disabled = false;
    saveBtnLabel.textContent = state.editingId ? "Save changes" : "Publish project";
    hideProgress();
    lucide.createIcons();
  }
});

/* --------------------------------------------------------------------------
 * 9. DELETE — Firestore document only
 * -------------------------------------------------------------------------- */
async function openConfirm(project) {
  if (!(await requireSession())) return;
  state.deleteTarget = project;
  confirmTitle.textContent = project.title;
  confirmOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  lucide.createIcons();
}

function closeConfirmFn() {
  confirmOverlay.classList.remove("open");
  document.body.style.overflow = "";
  state.deleteTarget = null;
}

confirmCancel.addEventListener("click", closeConfirmFn);
closeConfirmModal.addEventListener("click", closeConfirmFn);
confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) closeConfirmFn();
});

confirmDelete.addEventListener("click", async () => {
  const target = state.deleteTarget;
  if (!target || !(await requireSession())) return;

  const original = confirmDelete.innerHTML;
  confirmDelete.disabled = true;
  confirmDelete.innerHTML = `<span class="spinner"></span> Deleting…`;

  try {
    await deleteDoc(doc(db, PROJECTS_COLLECTION, target.id));
    toast(`“${target.title}” was deleted.`, "success");
  } catch (err) {
    console.error("[Fabuyo Admin] Delete failed:", err);
    toast("Delete failed — check your security rules.", "error");
  } finally {
    confirmDelete.disabled = false;
    confirmDelete.innerHTML = original;
    closeConfirmFn();
  }
});

/* --------------------------------------------------------------------------
 * 10. GLOBAL — Esc closes modals, icon bootstrap
 * -------------------------------------------------------------------------- */
addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (confirmOverlay.classList.contains("open")) closeConfirmFn();
  else if (projectOverlay.classList.contains("open")) closeProjectModalFn();
});

/* --------------------------------------------------------------------------
 * 11. BOOT
 * -------------------------------------------------------------------------- */
initAuth();
lucide.createIcons();
