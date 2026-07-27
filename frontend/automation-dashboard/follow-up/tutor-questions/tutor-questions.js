"use strict";

const API_BASE = "/automation-dashboard/api/ketso/tutor-questions";
const statusEl = document.getElementById("statusFilter");
const messageEl = document.getElementById("message");
const questionsEl = document.getElementById("questions");
const loadButton = document.getElementById("load");
const TIMEOUT_MESSAGE =
  "The request timed out. The change may already have been processed. Refresh the queue before trying again.";
const inFlightQuestionIds = new Set();
// Refresh IDs protect queue data and controls; status IDs protect messageEl.
let latestQuestionsRefreshId = 0;
let latestTutorStatusId = 0;

loadButton.addEventListener("click", () => loadQuestions());
statusEl.addEventListener("change", () => loadQuestions());

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

async function loadQuestions(
  statusMessage = "",
  tutorStatusId = nextTutorStatusId()
) {
  const refreshId = ++latestQuestionsRefreshId;
  setTutorMessage(tutorStatusId, statusMessage || "Loading...");
  questionsEl.replaceChildren();
  loadButton.disabled = true;
  try {
    const data = await request(`?status=${encodeURIComponent(statusEl.value)}`);
    if (refreshId !== latestQuestionsRefreshId) return;

    setTutorMessage(
      tutorStatusId,
      statusMessage || `${data.questions.length} question(s).`
    );
    questionsEl.innerHTML = data.questions.map(renderQuestion).join("");
    document.querySelectorAll("[data-answer]").forEach(button => {
      button.addEventListener("click", () => sendAnswer(button.dataset.answer, button));
    });
    document.querySelectorAll("[data-close]").forEach(button => {
      button.addEventListener("click", () => closeQuestion(button.dataset.close, button));
    });
    inFlightQuestionIds.forEach(questionId => {
      setQuestionActionsDisabled(questionId, true);
    });
  } catch (error) {
    if (refreshId !== latestQuestionsRefreshId) return;

    setTutorMessage(
      tutorStatusId,
      statusMessage
        ? `${statusMessage} Queue refresh failed: ${error.message}`
        : error.message
    );
  } finally {
    if (refreshId === latestQuestionsRefreshId) {
      loadButton.disabled = false;
    }
  }
}

function renderQuestion(question) {
  const answerId = `answer-${question.id}`;
  return `<article class="panel tutor-question-card">
    <h2>${escapeHtml(question.student_name)} <small>#${escapeHtml(question.student_id)}</small></h2>
    <p class="question-meta">${escapeHtml(question.course_name || question.course_key)} ·
      ${escapeHtml(question.module_name || question.module_key)} · ${formatDate(question.created_at)} ·
      <span class="question-status">${escapeHtml(question.status)}</span></p>
    <div class="question-text">${escapeHtml(question.question_text)}</div>
    <p class="notification-status">Tutor email: ${escapeHtml(notificationLabel(question.tutor_notification_status))}</p>
    ${question.answer_text
      ? `<p><strong>Answer</strong></p>
         <div class="question-text">${escapeHtml(question.answer_text)}</div>
         <p class="question-meta">Answered ${formatDate(question.answered_at)}</p>
         <p class="notification-status">Student email: ${escapeHtml(notificationLabel(question.student_notification_status))}</p>`
      : `<p><label for="${answerId}"><strong>Your answer</strong></label></p>
         <textarea class="answer-field" id="${answerId}" maxlength="10000"></textarea>
         <div class="review-actions">
           <button class="primary-action" type="button" data-answer="${escapeAttr(question.id)}">Send answer</button>
         </div>`}
    ${question.status !== "closed"
      ? `<div class="review-actions">
           <button type="button" data-close="${escapeAttr(question.id)}">Close question</button>
         </div>`
      : ""}
  </article>`;
}

async function sendAnswer(id, button) {
  if (isQuestionMutationInFlight(id)) return false;

  const field = document.getElementById(`answer-${id}`);
  const answer = field.value.trim();
  if (!answer) {
    setTutorMessage(nextTutorStatusId(), "Write an answer first.");
    field.focus();
    return;
  }
  if (!confirm("Send this checked answer to the student?")) return;

  const requestId = crypto.randomUUID
    ? crypto.randomUUID()
    : `answer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return runQuestionMutation(id, async tutorStatusId => {
    const data = await request(`/${encodeURIComponent(id)}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer, request_id: requestId })
    });
    await loadQuestions(answerConfirmation(data), tutorStatusId);
  });
}

async function closeQuestion(id, button) {
  if (isQuestionMutationInFlight(id)) return false;
  if (!confirm("Close this question?")) return;

  return runQuestionMutation(id, async tutorStatusId => {
    await request(`/${encodeURIComponent(id)}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    await loadQuestions("Question closed successfully.", tutorStatusId);
  });
}

async function runQuestionMutation(id, action) {
  const questionId = mutationId(id);
  if (!questionId || inFlightQuestionIds.has(questionId)) return false;

  const tutorStatusId = nextTutorStatusId();
  inFlightQuestionIds.add(questionId);
  setQuestionActionsDisabled(questionId, true);
  try {
    await action(tutorStatusId);
    return true;
  } catch (error) {
    setTutorMessage(tutorStatusId, error.message);
    return false;
  } finally {
    inFlightQuestionIds.delete(questionId);
    if (!inFlightQuestionIds.has(questionId)) {
      setQuestionActionsDisabled(questionId, false);
    }
  }
}

function isQuestionMutationInFlight(id) {
  const questionId = mutationId(id);
  return Boolean(questionId && inFlightQuestionIds.has(questionId));
}

function setQuestionActionsDisabled(questionId, disabled) {
  document.querySelectorAll("[data-answer], [data-close]").forEach(button => {
    const buttonQuestionId = mutationId(
      button.dataset.answer ?? button.dataset.close
    );
    if (buttonQuestionId === questionId) {
      button.disabled = disabled;
    }
  });

  const field = document.getElementById(`answer-${questionId}`);
  if (field) field.disabled = disabled;
}

function mutationId(value) {
  return value === undefined || value === null ? "" : String(value);
}

function nextTutorStatusId() {
  latestTutorStatusId += 1;
  return latestTutorStatusId;
}

function setTutorMessage(tutorStatusId, message) {
  if (tutorStatusId === latestTutorStatusId) {
    messageEl.textContent = message;
  }
}

function answerConfirmation(data) {
  const status = data.question?.student_notification_status;
  if (status === "accepted") {
    return "Answer saved. Student email: sent and accepted by the notification service.";
  }
  if (status === "not_configured") {
    return "Answer saved. Student email: skipped because notifications are not configured.";
  }
  if (status === "failed") {
    return "Answer saved. Student email: failed.";
  }
  if (!status && data.notification_sent === true) {
    return "Answer saved. Student email: sent and accepted by the notification service.";
  }
  return "Answer saved. Student email: outcome uncertain. Check the question before trying anything again.";
}

function notificationLabel(value) {
  return ({
    accepted: "accepted",
    failed: "failed",
    not_configured: "not configured",
    pending: "pending"
  })[value] || "unknown";
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

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "";
}

loadQuestions();
