"use strict";

const API_BASE =
  "/.netlify/functions/ketso-admin/admin-review";
const statusFilter = document.getElementById("statusFilter");
const courseFilter = document.getElementById("courseFilter");
const loadBtn = document.getElementById("loadBtn");
const statusBox = document.getElementById("status");
const uploadsBox = document.getElementById("uploads");
const TIMEOUT_MESSAGE =
  "The request timed out. The change may already have been processed. Refresh the queue before trying again.";
const inFlightUploadIds = new Set();
let latestUploadsRefreshId = 0;

loadBtn.addEventListener("click", () => loadUploads());
statusFilter.addEventListener("change", () => loadUploads());
courseFilter.addEventListener("change", () => loadUploads());

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Accept": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({
    ok: false,
    error: "Invalid response from the server."
  }));
  if (response.status === 504 && data.code === "UPSTREAM_TIMEOUT") {
    throw new Error(TIMEOUT_MESSAGE);
  }
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

async function loadUploads(successMessage = "") {
  const refreshId = ++latestUploadsRefreshId;
  statusBox.textContent = successMessage || "Loading uploads...";
  uploadsBox.replaceChildren();
  loadBtn.disabled = true;

  try {
    const query = new URLSearchParams({
      status: statusFilter.value,
      course_key: courseFilter.value
    });
    const data = await request(`/uploads?${query}`);
    const includeStaffUploads =
      new URLSearchParams(window.location.search).get("include_staff_uploads") === "1";
    const uploads = (data.uploads || []).filter(upload =>
      includeStaffUploads || !isDefaultHiddenStaffUpload(upload)
    );

    if (refreshId !== latestUploadsRefreshId) return;

    if (!uploads.length) {
      statusBox.textContent = successMessage
        ? `${successMessage} No uploads found.`
        : "No uploads found.";
      return;
    }

    const uploadsFoundMessage = `${uploads.length} upload(s) found.`;
    statusBox.textContent = successMessage
      ? `${successMessage} ${uploadsFoundMessage}`
      : uploadsFoundMessage;
    uploadsBox.innerHTML = uploads.map(renderUpload).join("");
    bindActions();
    inFlightUploadIds.forEach(uploadId => {
      setUploadActionsDisabled(uploadId, true);
    });
  } catch (error) {
    if (refreshId !== latestUploadsRefreshId) return;

    const loadError = error.message || "Request failed.";
    statusBox.textContent = successMessage
      ? `${successMessage} Queue refresh failed: ${loadError}`
      : `Error loading uploads: ${loadError}`;
  } finally {
    if (refreshId === latestUploadsRefreshId) {
      loadBtn.disabled = false;
    }
  }
}

function bindActions() {
  document.querySelectorAll("[data-action='approve-public']").forEach(button => {
    button.addEventListener("click", () => approveUpload(button, "public"));
  });
  document.querySelectorAll("[data-action='approve-private']").forEach(button => {
    button.addEventListener("click", () => approveUpload(button, "private"));
  });
  document.querySelectorAll("[data-action='reject']").forEach(button => {
    button.addEventListener("click", () => rejectUpload(button));
  });
  document.querySelectorAll("[data-action='hide']").forEach(button => {
    button.addEventListener("click", () => hideUpload(button));
  });
}

function renderUpload(upload) {
  const fileUrl = upload.cropped_file_url || upload.original_file_url || "";
  const duplicateWarning = renderDuplicateWarning(upload);
  const isTutorQuestion =
    upload.upload_type === "question_to_tutor" ||
    upload.lesson_key === "tutor_question";

  return `
    <article class="panel upload-card">
      <div class="upload-preview">${renderPreview(upload, fileUrl)}</div>
      <div class="upload-content">
        <h2>${escapeHtml(upload.uploader_name || "Student")}</h2>
        <div class="upload-meta">
          <strong>Email:</strong> ${escapeHtml(upload.uploader_email || "")}<br>
          <strong>Upload ID:</strong> ${escapeHtml(upload.id)}<br>
          <strong>Category:</strong> ${escapeHtml(upload.category || "")}<br>
          <strong>Student ID:</strong> ${escapeHtml(upload.academy_student_id || "")}<br>
          <strong>Cohort:</strong> ${escapeHtml(upload.academy_cohort || "")}<br>
          <strong>Course:</strong> ${escapeHtml(labelCourse(upload.course_key))}<br>
          <strong>Interest:</strong> ${escapeHtml(labelInterest(upload.interest_area || upload.academy_track))}<br>
          <strong>Lesson:</strong> ${escapeHtml(labelLesson(upload.lesson_key))}<br>
          <strong>Upload type:</strong> ${escapeHtml(upload.upload_type || upload.file_type || "")}<br>
          <strong>Status:</strong> ${escapeHtml(upload.verification_status || "")}<br>
          <strong>Gallery:</strong> ${escapeHtml(upload.public_gallery_status || "")}<br>
          <strong>Points:</strong> ${escapeHtml(upload.points_awarded || 0)}
        </div>
        <div class="upload-feedback">
          <strong>AI feedback</strong><br>
          ${escapeHtml(upload.ai_feedback || upload.ai_description || "No AI feedback available.")}
        </div>
        ${duplicateWarning}
        <div class="review-actions">
          ${isTutorQuestion ? "" : `<button class="primary-action" data-action="approve-public" data-id="${escapeAttr(upload.id)}" type="button">Approve public</button>`}
          <button data-action="approve-private" data-id="${escapeAttr(upload.id)}" type="button">Approve private</button>
          <button data-action="hide" data-id="${escapeAttr(upload.id)}" type="button">Hide</button>
          <button class="danger-action" data-action="reject" data-id="${escapeAttr(upload.id)}" type="button">Reject</button>
          ${upload.academy_student_id
            ? `<a class="secondary-action" href="https://ketso-uploader.pages.dev/student-profile/?student_id=${encodeURIComponent(upload.academy_student_id)}" target="_blank" rel="noopener">Open student profile</a>`
            : ""}
        </div>
      </div>
    </article>`;
}

function isDefaultHiddenStaffUpload(upload) {
  return upload &&
    upload.upload_context === "staff_upload" &&
    upload.verification_status === "not_required";
}

function renderDuplicateWarning(upload) {
  const isOnboarding =
    upload.category === "academy_onboarding" ||
    upload.lesson_key === "onboarding";
  const count = Number(upload.existing_approved_onboarding_count || 0);
  if (!isOnboarding || !upload.academy_student_id || count < 1) return "";

  return `
    <div class="duplicate-warning">
      <strong>Possible duplicate onboarding upload</strong><br>
      This student already has ${count} approved public onboarding upload${count === 1 ? "" : "s"}.
      Latest approved onboarding upload ID: ${escapeHtml(upload.latest_approved_onboarding_id || "")}.
      Approve only if this should intentionally replace or add to the student's public onboarding record.
    </div>`;
}

function renderPreview(upload, fileUrl) {
  const safeFileUrl = validateFileUrl(fileUrl);
  if (!safeFileUrl) return "<p>File preview unavailable.</p>";
  const fileType = upload.file_type || upload.upload_type || "";
  if (fileType === "image" || fileType === "image_photo") {
    return `<img src="${escapeAttr(safeFileUrl)}" alt="Upload preview" loading="lazy">`;
  }
  if (fileType === "video") {
    return `<video controls preload="metadata" src="${escapeAttr(safeFileUrl)}"></video>`;
  }
  return `<a class="secondary-action" href="${escapeAttr(safeFileUrl)}" target="_blank" rel="noopener">Open file</a>`;
}

function validateFileUrl(value) {
  if (typeof value !== "string" || !value || value !== value.trim()) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "https:" ? parsedUrl.href : null;
  } catch {
    return null;
  }
}

async function approveUpload(button, publicGalleryStatus) {
  const id = button.dataset.id;
  const label = publicGalleryStatus === "public"
    ? "approve this upload publicly"
    : "approve this upload privately";
  if (!confirm(`Are you sure you want to ${label}?`)) return;

  const successMessage = publicGalleryStatus === "public"
    ? "Upload approved publicly."
    : "Upload approved privately.";
  await runAction(button, "Approval failed.", successMessage, async () => {
    await request(`/uploads/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_gallery_status: publicGalleryStatus })
    });
  });
}

async function rejectUpload(button) {
  const reason = prompt("Reason for rejection?", "Needs clearer upload");
  if (reason === null) return;

  await runAction(button, "Rejection failed.", "Upload rejected.", async () => {
    await request(`/uploads/${encodeURIComponent(button.dataset.id)}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
  });
}

async function hideUpload(button) {
  const reason = prompt("Optional reason for hiding this upload:", "Hidden by admin");
  if (reason === null) return;

  await runAction(button, "Hide failed.", "Upload hidden.", async () => {
    await request(`/uploads/${encodeURIComponent(button.dataset.id)}/hide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
  });
}

async function runAction(button, fallback, successMessage, action) {
  const uploadId = mutationId(button?.dataset?.id);
  if (!uploadId || inFlightUploadIds.has(uploadId)) return false;

  inFlightUploadIds.add(uploadId);
  setUploadActionsDisabled(uploadId, true);
  try {
    await action();
    await loadUploads(successMessage);
    return true;
  } catch (error) {
    alert(error.message || fallback);
    return false;
  } finally {
    inFlightUploadIds.delete(uploadId);
    if (!inFlightUploadIds.has(uploadId)) {
      setUploadActionsDisabled(uploadId, false);
    }
  }
}

function setUploadActionsDisabled(uploadId, disabled) {
  document.querySelectorAll("[data-action][data-id]").forEach(button => {
    if (mutationId(button.dataset.id) === uploadId) {
      button.disabled = disabled;
    }
  });
}

function mutationId(value) {
  return value === undefined || value === null ? "" : String(value);
}

function labelLesson(value) {
  const map = {
    onboarding: "Onboarding",
    lesson_1_climate_change: "Lesson 1 Climate Change",
    lesson_2_tree_health: "Lesson 2 Tree Health",
    lesson_3_tree_planting: "Lesson 3 Tree Planting",
    lesson_4_co2_increase: "Lesson 4 We cause Carbon Dioxide Increase",
    arb1_module_1_tree_biology: "Module 1: Introduction to Arboriculture",
    arb1_module_2_tree_identification: "Module 2: Observing trees",
    arb1_basic_chemistry_plant_growth: "Module 3: Basic chemistry for plant growth",
    arb1_tree_physiology: "Module 4: Tree Physiology",
    arb1_module_3_soil_and_roots: "Module 5: Soil and roots",
    arb1_module_4_tree_selection: "Module 6: Choosing the right tree",
    arb1_module_5_tree_planting: "Module 7: Tree planting",
    arb1_module_6_tree_care: "Module 8: Young tree care",
    arb1_module_7_tree_health: "Module 9: Tree health assessment",
    arb1_module_8_pruning: "Module 10: Basic pruning",
    evaluation: "Evaluation"
  };
  return map[value] || value || "Not set";
}

function labelCourse(value) {
  return value === "arboriculture_1" ? "Arboriculture I" : "Online tree planting";
}

function labelInterest(value) {
  const map = {
    online_tree_planting: "Online tree planting",
    distance_certificate_course: "Distance certificate course",
    donor_investor_funding: "Donor and investor funding",
    networking_advocacy: "Networking & Advocacy"
  };
  return map[value] || value || "Not set";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

loadUploads();
