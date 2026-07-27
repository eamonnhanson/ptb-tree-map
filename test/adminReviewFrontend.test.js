import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const scriptUrl = new URL(
  "../frontend/automation-dashboard/ketso/admin-review/admin-review.js",
  import.meta.url
);

function element(value = "") {
  const listeners = new Map();
  return {
    value,
    textContent: "",
    innerHTML: "",
    disabled: false,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    replaceChildren() {
      this.innerHTML = "";
    },
    dispatch(type, event = {}) {
      return listeners.get(type)?.(event);
    }
  };
}

async function frontendContext({
  fetchImpl = async () => ({
    ok: true,
    status: 200,
    async json() {
      return { ok: true, uploads: [] };
    }
  }),
  confirmImpl = () => false,
  promptImpl = () => null,
  alertImpl = () => {},
  actionControls = []
} = {}) {
  const elements = {
    statusFilter: element("pending"),
    courseFilter: element("all"),
    loadBtn: element(),
    status: element(),
    uploads: element()
  };
  const source = await readFile(scriptUrl, "utf8");
  const context = vm.createContext({
    document: {
      getElementById(id) {
        return elements[id];
      },
      querySelectorAll(selector) {
        return selector === "[data-action][data-id]" ? actionControls : [];
      }
    },
    window: { location: { search: "" } },
    fetch: fetchImpl,
    URL,
    URLSearchParams,
    encodeURIComponent,
    confirm: confirmImpl,
    prompt: promptImpl,
    alert: alertImpl,
    console
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { context, elements };
}

function actionButton(id, action) {
  return {
    ...element(),
    dataset: { id, action }
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function uploadQueue(uploads) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { ok: true, uploads };
    }
  };
}

async function evaluate(context, expression, values = {}) {
  Object.assign(context, values);
  return vm.runInContext(expression, context);
}

test("only the most recently started Admin refresh may update the page", async () => {
  const olderResponse = deferred();
  const newerResponse = deferred();
  let requestCount = 0;
  const { elements } = await frontendContext({
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) return uploadQueue([]);
      return requestCount === 2 ? olderResponse.promise : newerResponse.promise;
    }
  });

  const olderRefresh = elements.loadBtn.dispatch("click");
  const newerRefresh = elements.statusFilter.dispatch("change");

  newerResponse.resolve(uploadQueue([{
    id: "new-upload",
    uploader_name: "Newest queue",
    file_type: "document",
    original_file_url: "https://files.example/new.pdf",
    verification_status: "pending"
  }]));
  await newerRefresh;

  assert.match(elements.uploads.innerHTML, /Newest queue/);
  assert.doesNotMatch(elements.uploads.innerHTML, /Stale queue/);
  assert.equal(elements.status.textContent, "1 upload(s) found.");
  assert.equal(elements.loadBtn.disabled, false);

  olderResponse.resolve(uploadQueue([{
    id: "old-upload",
    uploader_name: "Stale queue",
    file_type: "document",
    original_file_url: "https://files.example/old.pdf",
    verification_status: "pending"
  }]));
  await olderRefresh;

  assert.match(elements.uploads.innerHTML, /Newest queue/);
  assert.doesNotMatch(elements.uploads.innerHTML, /Stale queue/);
  assert.equal(elements.status.textContent, "1 upload(s) found.");
  assert.equal(elements.loadBtn.disabled, false);
});

test("stale Admin errors and empty results cannot overwrite newer status", async () => {
  const staleError = deferred();
  const currentResponse = deferred();
  let requestCount = 0;
  const { context, elements } = await frontendContext({
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) return uploadQueue([]);
      return requestCount === 2 ? staleError.promise : currentResponse.promise;
    }
  });

  const olderRefresh = evaluate(
    context,
    "loadUploads('Older mutation succeeded.')"
  );
  const newerRefresh = evaluate(
    context,
    "loadUploads('Newest mutation succeeded.')"
  );

  currentResponse.resolve(uploadQueue([{
    id: "current-upload",
    uploader_name: "Current upload",
    file_type: "image",
    original_file_url: "https://files.example/current.jpg",
    verification_status: "pending"
  }]));
  await newerRefresh;

  const currentMarkup = elements.uploads.innerHTML;
  const currentStatus = elements.status.textContent;
  staleError.reject(new Error("stale network failure"));
  await olderRefresh;

  assert.equal(elements.uploads.innerHTML, currentMarkup);
  assert.equal(elements.status.textContent, currentStatus);
  assert.equal(
    elements.status.textContent,
    "Newest mutation succeeded. 1 upload(s) found."
  );
  assert.doesNotMatch(elements.status.textContent, /stale network failure/);

  context.fetch = async () => {
    throw new Error("current network failure");
  };
  await evaluate(context, "loadUploads('Latest mutation succeeded.')");

  assert.equal(elements.uploads.innerHTML, "");
  assert.equal(
    elements.status.textContent,
    "Latest mutation succeeded. Queue refresh failed: current network failure"
  );
});

test("a current Admin error survives a stale empty response", async () => {
  const staleEmptyResponse = deferred();
  const currentError = deferred();
  let requestCount = 0;
  const { context, elements } = await frontendContext({
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) return uploadQueue([]);
      return requestCount === 2
        ? staleEmptyResponse.promise
        : currentError.promise;
    }
  });

  const olderRefresh = evaluate(context, "loadUploads()");
  const newerRefresh = evaluate(context, "loadUploads()");

  currentError.reject(new Error("latest Admin failure"));
  await newerRefresh;
  assert.equal(
    elements.status.textContent,
    "Error loading uploads: latest Admin failure"
  );

  staleEmptyResponse.resolve(uploadQueue([]));
  await olderRefresh;
  assert.equal(elements.uploads.innerHTML, "");
  assert.equal(
    elements.status.textContent,
    "Error loading uploads: latest Admin failure"
  );
});

test("parallel upload mutations keep the newest real queue refresh authoritative", async () => {
  const firstAction = deferred();
  const secondAction = deferred();
  const firstRefresh = deferred();
  const secondRefresh = deferred();
  const firstButton = actionButton("upload-1", "approve-public");
  const secondButton = actionButton("upload-2", "reject");
  let fetchCount = 0;
  let mutationCount = 0;
  const { context, elements } = await frontendContext({
    actionControls: [firstButton, secondButton],
    fetchImpl: async () => {
      fetchCount += 1;
      if (fetchCount === 1) return uploadQueue([]);
      return fetchCount === 2 ? firstRefresh.promise : secondRefresh.promise;
    }
  });

  const firstMutation = evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: firstButton,
      fallback: "Approval failed.",
      successMessage: "Upload approved publicly.",
      action: async () => {
        mutationCount += 1;
        await firstAction.promise;
      }
    }
  );
  const secondMutation = evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: secondButton,
      fallback: "Rejection failed.",
      successMessage: "Upload rejected.",
      action: async () => {
        mutationCount += 1;
        await secondAction.promise;
      }
    }
  );

  assert.equal(mutationCount, 2);
  assert.equal(firstButton.disabled, true);
  assert.equal(secondButton.disabled, true);

  firstAction.resolve();
  await new Promise(resolve => setImmediate(resolve));
  secondAction.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fetchCount, 3);

  secondRefresh.resolve(uploadQueue([]));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(
    elements.status.textContent,
    "Upload rejected. No uploads found."
  );

  firstRefresh.resolve(uploadQueue([{
    id: "stale-upload",
    uploader_name: "Already processed upload",
    file_type: "document",
    original_file_url: "https://files.example/stale.pdf",
    verification_status: "pending"
  }]));
  await Promise.all([firstMutation, secondMutation]);

  assert.equal(elements.uploads.innerHTML, "");
  assert.equal(
    elements.status.textContent,
    "Upload rejected. No uploads found."
  );
  assert.equal(firstButton.disabled, false);
  assert.equal(secondButton.disabled, false);
});

test("the same upload remains single-flight with the real refresh function", async () => {
  const action = deferred();
  const firstButton = actionButton("upload-1", "approve-public");
  const secondButton = actionButton("upload-1", "reject");
  let mutationCount = 0;
  let fetchCount = 0;
  const { context } = await frontendContext({
    actionControls: [firstButton, secondButton],
    fetchImpl: async () => {
      fetchCount += 1;
      return uploadQueue([]);
    }
  });

  const firstMutation = evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: firstButton,
      fallback: "Approval failed.",
      successMessage: "Upload approved publicly.",
      action: async () => {
        mutationCount += 1;
        await action.promise;
      }
    }
  );
  const blockedMutation = evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: secondButton,
      fallback: "Rejection failed.",
      successMessage: "Upload rejected.",
      action: async () => {
        mutationCount += 1;
      }
    }
  );

  assert.equal(await blockedMutation, false);
  assert.equal(mutationCount, 1);
  action.resolve();
  assert.equal(await firstMutation, true);
  assert.equal(fetchCount, 2);
});

test("valid absolute HTTPS URLs are normalized and remain visible", async () => {
  const { context } = await frontendContext();

  assert.equal(
    await evaluate(context, "validateFileUrl(input)", {
      input: "HTTPS://Files.Example/trees/photo.jpg"
    }),
    "https://files.example/trees/photo.jpg"
  );

  const image = await evaluate(context, "renderPreview(upload, input)", {
    upload: { file_type: "image" },
    input: "https://files.example/tree photo.jpg"
  });
  assert.match(image, /<img /);
  assert.match(image, /src="https:\/\/files\.example\/tree%20photo\.jpg"/);

  const video = await evaluate(context, "renderPreview(upload, input)", {
    upload: { file_type: "video" },
    input: "https://files.example/tree-video.mp4"
  });
  assert.match(video, /<video /);
  assert.match(video, /src="https:\/\/files\.example\/tree-video\.mp4"/);

  const file = await evaluate(context, "renderPreview(upload, input)", {
    upload: { file_type: "document" },
    input: "https://files.example/assessment.pdf"
  });
  assert.match(file, /<a /);
  assert.match(file, /href="https:\/\/files\.example\/assessment\.pdf"/);
});

const invalidFileUrls = [
  ["javascript", "javascript:alert(1)"],
  ["javascript with mixed case and whitespace", " \tJaVaScRiPt:alert(1)"],
  ["javascript with encoded characters", "java%73cript:alert(1)"],
  ["data HTML", "data:text/html,<script>alert(1)</script>"],
  ["data SVG image", "data:image/svg+xml,<svg onload=alert(1)>"],
  ["vbscript", "vbscript:msgbox(1)"],
  ["file", "file:///etc/passwd"],
  ["blob", "blob:https://files.example/1234"],
  ["plain HTTP", "http://files.example/photo.jpg"],
  ["protocol-relative", "//files.example/photo.jpg"],
  ["relative", "/uploads/photo.jpg"],
  ["empty", ""],
  ["invalid text", "this is not a URL"]
];

for (const [label, input] of invalidFileUrls) {
  test(`rejects ${label} without rendering a link or preview`, async () => {
    const { context } = await frontendContext();

    assert.equal(
      await evaluate(context, "validateFileUrl(input)", { input }),
      null
    );

    for (const fileType of ["image", "video", "document"]) {
      const markup = await evaluate(context, "renderPreview(upload, input)", {
        upload: { file_type: fileType },
        input
      });
      assert.equal(markup, "<p>File preview unavailable.</p>");
      assert.doesNotMatch(markup, /\bhref\s*=/i);
      assert.doesNotMatch(markup, /\bsrc\s*=/i);
      assert.doesNotMatch(markup, /<(?:a|img|video)\b/i);
    }
  });
}

test("an invalid file URL leaves the rest of the upload card usable", async () => {
  const { context } = await frontendContext();
  const markup = await evaluate(context, "renderUpload(upload)", {
    upload: {
      id: "upload-123",
      uploader_name: "Test student",
      original_file_url: "javascript:alert(1)",
      file_type: "image",
      verification_status: "pending"
    }
  });

  assert.match(markup, /Test student/);
  assert.match(markup, /File preview unavailable/);
  assert.match(markup, /data-action="approve-private"/);
  assert.match(markup, /data-action="reject"/);
  assert.doesNotMatch(markup, /\bhref="javascript:/i);
  assert.doesNotMatch(markup, /\bsrc="javascript:/i);
  assert.doesNotMatch(markup, /<img\b/i);
});

test("a successful mutation keeps its confirmation after a successful refresh", async () => {
  const { context, elements } = await frontendContext();
  let mutationCount = 0;

  await evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: actionButton("upload-1", "approve-public"),
      fallback: "Approval failed.",
      successMessage: "Upload approved publicly.",
      action: async () => {
        mutationCount += 1;
      }
    }
  );

  assert.equal(mutationCount, 1);
  assert.equal(
    elements.status.textContent,
    "Upload approved publicly. No uploads found."
  );
});

test("a success confirmation remains visible while the queue refresh is pending", async () => {
  const { context, elements } = await frontendContext();
  let resolveRefresh;
  context.fetch = () => new Promise(resolve => {
    resolveRefresh = resolve;
  });

  const refresh = evaluate(
    context,
    "loadUploads('Upload approved privately.')"
  );

  assert.equal(elements.status.textContent, "Upload approved privately.");

  resolveRefresh({
    ok: true,
    status: 200,
    async json() {
      return { ok: true, uploads: [] };
    }
  });
  await refresh;

  assert.equal(
    elements.status.textContent,
    "Upload approved privately. No uploads found."
  );
});

test("manual loads do not treat browser events as success messages", async () => {
  const { elements } = await frontendContext();

  await elements.loadBtn.dispatch("click", { type: "click" });

  assert.equal(elements.status.textContent, "No uploads found.");
  assert.doesNotMatch(elements.status.textContent, /\[object Event\]/);
});

test("a successful mutation keeps its confirmation when refresh fails", async () => {
  let requestCount = 0;
  const { context, elements } = await frontendContext({
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true, uploads: [] };
          }
        };
      }
      throw new Error("Network unavailable");
    }
  });

  await evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: actionButton("upload-1", "reject"),
      fallback: "Rejection failed.",
      successMessage: "Upload rejected.",
      action: async () => {}
    }
  );

  assert.equal(
    elements.status.textContent,
    "Upload rejected. Queue refresh failed: Network unavailable"
  );
});

test("a successful mutation keeps its confirmation when refresh times out", async () => {
  let requestCount = 0;
  const { context, elements } = await frontendContext({
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true, uploads: [] };
          }
        };
      }
      return {
        ok: false,
        status: 504,
        async json() {
          return {
            ok: false,
            code: "UPSTREAM_TIMEOUT",
            error: "The upstream service timed out."
          };
        }
      };
    }
  });

  await evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: actionButton("upload-1", "hide"),
      fallback: "Hide failed.",
      successMessage: "Upload hidden.",
      action: async () => {}
    }
  );

  assert.equal(
    elements.status.textContent,
    "Upload hidden. Queue refresh failed: The request timed out. " +
      "The change may already have been processed. Refresh the queue before trying again."
  );
});

test("a failed mutation does not refresh the queue", async () => {
  let refreshCount = 0;
  const alerts = [];
  const { context, elements } = await frontendContext({
    alertImpl: message => alerts.push(message)
  });
  const button = actionButton("upload-1", "approve-private");

  await evaluate(
    context,
    "loadUploads = async () => { refreshCount += 1; }; " +
      "runAction(button, fallback, successMessage, action)",
    {
      button,
      fallback: "Approval failed.",
      successMessage: "Upload approved privately.",
      action: async () => {
        throw new Error("Mutation failed");
      },
      refreshCount
    }
  );

  refreshCount = await evaluate(context, "refreshCount");
  assert.equal(refreshCount, 0);
  assert.deepEqual(alerts, ["Mutation failed"]);
  assert.equal(elements.status.textContent, "No uploads found.");
  assert.equal(button.disabled, false);
});

test("an uncertain mutation outcome shows only the existing timeout warning", async () => {
  let refreshCount = 0;
  const alerts = [];
  const { context, elements } = await frontendContext({
    alertImpl: message => alerts.push(message)
  });

  await evaluate(
    context,
    "loadUploads = async () => { refreshCount += 1; }; " +
      "runAction(button, fallback, successMessage, action)",
    {
      button: actionButton("upload-1", "approve-public"),
      fallback: "Approval failed.",
      successMessage: "Upload approved publicly.",
      action: async () => {
        throw new Error(
          "The request timed out. The change may already have been processed. " +
            "Refresh the queue before trying again."
        );
      },
      refreshCount
    }
  );

  refreshCount = await evaluate(context, "refreshCount");
  assert.equal(refreshCount, 0);
  assert.deepEqual(alerts, [
    "The request timed out. The change may already have been processed. " +
      "Refresh the queue before trying again."
  ]);
  assert.equal(elements.status.textContent, "No uploads found.");
});

test("an Admin review action sends one mutation and never retries it", async () => {
  let requestCount = 0;
  let mutationCount = 0;
  const alerts = [];
  const { context } = await frontendContext({
    confirmImpl: () => true,
    alertImpl: message => alerts.push(message),
    fetchImpl: async (url, options = {}) => {
      requestCount += 1;
      if (requestCount === 1) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true, uploads: [] };
          }
        };
      }
      if (options.method === "POST") {
        mutationCount += 1;
        return {
          ok: false,
          status: 504,
          async json() {
            return {
              ok: false,
              code: "UPSTREAM_TIMEOUT",
              error: "The upstream service timed out."
            };
          }
        };
      }
      throw new Error(`Unexpected request to ${url}`);
    }
  });

  await evaluate(context, "approveUpload(button, 'public')", {
    button: { ...element(), dataset: { id: "upload-123" } }
  });

  assert.equal(mutationCount, 1);
  assert.deepEqual(alerts, [
    "The request timed out. The change may already have been processed. " +
      "Refresh the queue before trying again."
  ]);
});

test("starting one upload mutation disables every action for that upload", async () => {
  const buttons = [
    actionButton("upload-1", "approve-public"),
    actionButton("upload-1", "approve-private"),
    actionButton("upload-1", "hide"),
    actionButton("upload-1", "reject"),
    actionButton("upload-2", "reject")
  ];
  const { context } = await frontendContext({ actionControls: buttons });
  let finishMutation;

  await evaluate(context, "loadUploads = async () => {}");
  const pending = evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: buttons[0],
      fallback: "Approval failed.",
      successMessage: "Upload approved publicly.",
      action: () => new Promise(resolve => {
        finishMutation = resolve;
      })
    }
  );

  assert.deepEqual(buttons.slice(0, 4).map(button => button.disabled), [
    true,
    true,
    true,
    true
  ]);
  assert.equal(buttons[4].disabled, false);

  finishMutation();
  await pending;
});

test("a second action and a fast double click send only one upload mutation", async () => {
  const buttons = [
    actionButton("upload-1", "approve-public"),
    actionButton("upload-1", "reject")
  ];
  const { context } = await frontendContext({ actionControls: buttons });
  let mutationCount = 0;
  let finishMutation;
  const firstAction = () => {
    mutationCount += 1;
    return new Promise(resolve => {
      finishMutation = resolve;
    });
  };
  const blockedAction = async () => {
    mutationCount += 1;
  };

  await evaluate(context, "loadUploads = async () => {}");
  const first = evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: buttons[0],
      fallback: "Approval failed.",
      successMessage: "Upload approved publicly.",
      action: firstAction
    }
  );
  const conflicting = evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: buttons[1],
      fallback: "Rejection failed.",
      successMessage: "Upload rejected.",
      action: blockedAction
    }
  );
  const doubleClick = evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: buttons[0],
      fallback: "Approval failed.",
      successMessage: "Upload approved publicly.",
      action: blockedAction
    }
  );

  assert.equal(await conflicting, false);
  assert.equal(await doubleClick, false);
  assert.equal(mutationCount, 1);

  finishMutation();
  assert.equal(await first, true);
  assert.equal(mutationCount, 1);
});

test("upload in-flight state is cleaned up after success and failure", async () => {
  const button = actionButton("upload-1", "approve-private");
  const alerts = [];
  const { context } = await frontendContext({
    actionControls: [button],
    alertImpl: message => alerts.push(message)
  });
  let mutationCount = 0;

  await evaluate(context, "loadUploads = async () => {}");
  assert.equal(await evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button,
      fallback: "Approval failed.",
      successMessage: "Upload approved privately.",
      action: async () => {
        mutationCount += 1;
      }
    }
  ), true);
  assert.equal(button.disabled, false);

  assert.equal(await evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button,
      fallback: "Approval failed.",
      successMessage: "Upload approved privately.",
      action: async () => {
        mutationCount += 1;
        throw new Error("Mutation failed");
      }
    }
  ), false);
  assert.equal(button.disabled, false);

  assert.equal(await evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button,
      fallback: "Approval failed.",
      successMessage: "Upload approved privately.",
      action: async () => {
        mutationCount += 1;
      }
    }
  ), true);
  assert.equal(mutationCount, 3);
  assert.deepEqual(alerts, ["Mutation failed"]);
});

test("different uploads can mutate independently", async () => {
  const firstButton = actionButton("upload-1", "approve-public");
  const secondButton = actionButton("upload-2", "reject");
  const { context } = await frontendContext({
    actionControls: [firstButton, secondButton]
  });
  let firstCount = 0;
  let secondCount = 0;
  let finishFirst;
  let finishSecond;

  await evaluate(context, "loadUploads = async () => {}");
  const first = evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: firstButton,
      fallback: "Approval failed.",
      successMessage: "Upload approved publicly.",
      action: () => {
        firstCount += 1;
        return new Promise(resolve => {
          finishFirst = resolve;
        });
      }
    }
  );
  const second = evaluate(
    context,
    "runAction(button, fallback, successMessage, action)",
    {
      button: secondButton,
      fallback: "Rejection failed.",
      successMessage: "Upload rejected.",
      action: () => {
        secondCount += 1;
        return new Promise(resolve => {
          finishSecond = resolve;
        });
      }
    }
  );

  assert.equal(firstButton.disabled, true);
  assert.equal(secondButton.disabled, true);
  assert.equal(firstCount, 1);
  assert.equal(secondCount, 1);

  finishFirst();
  await first;
  assert.equal(firstButton.disabled, false);
  assert.equal(secondButton.disabled, true);

  finishSecond();
  await second;
  assert.equal(secondButton.disabled, false);
});

const successfulAdminActions = [
  {
    label: "public approval",
    expression: "approveUpload(button, 'public')",
    successMessage: "Upload approved publicly."
  },
  {
    label: "private approval",
    expression: "approveUpload(button, 'private')",
    successMessage: "Upload approved privately."
  },
  {
    label: "rejection",
    expression: "rejectUpload(button)",
    successMessage: "Upload rejected."
  },
  {
    label: "hiding",
    expression: "hideUpload(button)",
    successMessage: "Upload hidden."
  }
];

for (const action of successfulAdminActions) {
  test(`${action.label} uses its specific persistent success message`, async () => {
    let requestCount = 0;
    let mutationCount = 0;
    const { context, elements } = await frontendContext({
      confirmImpl: () => true,
      promptImpl: () => "Test reason",
      fetchImpl: async (_url, options = {}) => {
        requestCount += 1;
        if (requestCount > 1 && options.method === "POST") {
          mutationCount += 1;
          return {
            ok: true,
            status: 200,
            async json() {
              return { ok: true };
            }
          };
        }
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true, uploads: [] };
          }
        };
      }
    });

    await evaluate(context, action.expression, {
      button: { ...element(), dataset: { id: "upload-123" } }
    });

    assert.equal(mutationCount, 1);
    assert.equal(
      elements.status.textContent,
      `${action.successMessage} No uploads found.`
    );
  });
}
