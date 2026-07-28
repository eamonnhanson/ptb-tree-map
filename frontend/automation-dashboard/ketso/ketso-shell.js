export const KETSO_VIEWS = Object.freeze({
  "staff-upload": {
    title: "Staff Upload Dashboard",
    url: "https://ketso-uploader.pages.dev/staff-upload-dashboard/"
  },
  "content-uploader": {
    title: "Content Uploader",
    url: "https://ketso-uploader.pages.dev/"
  },
  "ketso-gallery": {
    title: "KETSO Gallery",
    url: "https://ketso-uploader.pages.dev/gallery"
  },
  "student-gallery": {
    title: "Student Gallery",
    url: "https://ketso-uploader.pages.dev/student-gallery/"
  },
  "academy-onboarding": {
    title: "Academy Onboarding",
    url: "https://ketso-uploader.pages.dev/academy-onboarding/"
  },
  "admin-review": {
    title: "Admin Review",
    url: "/automation-dashboard/ketso/admin-review/"
  },
  "admin-gallery": {
    title: "Admin Gallery",
    url: "https://ketso-uploader.pages.dev/admin-gallery/"
  }
});

export function allowedView(value) {
  return Object.hasOwn(KETSO_VIEWS, value) ? value : null;
}

function initializeShell() {
  const content = document.querySelector("[data-ketso-content]");
  const frame = document.querySelector("[data-ketso-frame]");
  const title = document.querySelector("[data-ketso-title]");
  const external = document.querySelector("[data-ketso-external]");
  const loading = document.querySelector("[data-ketso-loading]");
  const help = document.querySelector("[data-ketso-help]");
  const links = [...document.querySelectorAll("[data-ketso-view]")];
  let loadTimer;

  if (!content || !frame || !title || !external || !loading || !help) return;

  function setActiveLink(viewId) {
    links.forEach(link => {
      const active = link.dataset.ketsoView === viewId;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function showHome() {
    clearTimeout(loadTimer);
    frame.removeAttribute("src");
    content.hidden = true;
    loading.hidden = true;
    help.hidden = true;
    setActiveLink(null);
    document.title = "KETSO";
  }

  function showView(viewId) {
    const view = KETSO_VIEWS[viewId];
    if (!view) {
      showHome();
      return;
    }

    content.hidden = false;
    title.textContent = view.title;
    external.href = view.url;
    frame.title = `${view.title} — KETSO`;
    loading.hidden = false;
    help.hidden = true;
    setActiveLink(viewId);
    document.title = `${view.title} | KETSO`;

    clearTimeout(loadTimer);
    frame.src = view.url;
    loadTimer = setTimeout(() => {
      loading.hidden = true;
      help.hidden = false;
    }, 12000);
    content.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function restoreFromUrl() {
    const requested = new URL(window.location.href).searchParams.get("view");
    const viewId = allowedView(requested);
    if (viewId) showView(viewId);
    else showHome();
  }

  frame.addEventListener("load", () => {
    clearTimeout(loadTimer);
    loading.hidden = true;
  });

  window.addEventListener("securitypolicyviolation", event => {
    if (event.violatedDirective !== "frame-src") return;
    clearTimeout(loadTimer);
    loading.hidden = true;
    help.hidden = false;
  });

  links.forEach(link => {
    link.addEventListener("click", event => {
      const viewId = allowedView(link.dataset.ketsoView);
      if (!viewId) return;
      event.preventDefault();
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("view", viewId);
      url.hash = "";
      history.pushState({ view: viewId }, "", url);
      showView(viewId);
    });
  });

  window.addEventListener("popstate", restoreFromUrl);
  restoreFromUrl();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeShell, { once: true });
  } else {
    initializeShell();
  }
}
