import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const scriptUrl = new URL(
  "../frontend/automation-dashboard/follow-up/tutor-questions/tutor-questions.js",
  import.meta.url
);

function element(value = "") {
  const listeners = new Map();
  return {
    value,
    textContent: "",
    innerHTML: "",
    disabled: false,
    dataset: {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    replaceChildren() {
      this.innerHTML = "";
    },
    dispatch(type, event = {}) {
      return listeners.get(type)?.(event);
    },
    focus() {}
  };
}

async function frontendContext(fetchImpl, {
  confirmImpl = () => true,
  actionControls = [],
  extraElements = {}
} = {}) {
  const elements = {
    statusFilter: element("new"),
    message: element(),
    questions: element(),
    load: element(),
    ...extraElements
  };
  const source = await readFile(scriptUrl, "utf8");
  const context = vm.createContext({
    document: {
      getElementById(id) {
        return elements[id];
      },
      querySelectorAll(selector) {
        return selector === "[data-answer], [data-close]"
          ? actionControls
          : [];
      }
    },
    fetch: fetchImpl,
    URLSearchParams,
    encodeURIComponent,
    confirm: confirmImpl,
    crypto: { randomUUID: () => "request-123" },
    console
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { context, elements };
}

function questionButton(id, action) {
  const button = element();
  button.dataset[action] = id;
  return button;
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

function successfulQueue() {
  return {
    ok: true,
    status: 200,
    async json() {
      return { ok: true, questions: [] };
    }
  };
}

function questionQueue(questions) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { ok: true, questions };
    }
  };
}

function successfulMutation(data = { ok: true }) {
  return {
    ok: true,
    status: 200,
    async json() {
      return data;
    }
  };
}

test("only the most recently started tutor refresh may update the page", async () => {
  const olderResponse = deferred();
  const newerResponse = deferred();
  let requestCount = 0;
  const { elements } = await frontendContext(async () => {
    requestCount += 1;
    if (requestCount === 1) return successfulQueue();
    return requestCount === 2 ? olderResponse.promise : newerResponse.promise;
  });

  const olderRefresh = elements.load.dispatch("click");
  const newerRefresh = elements.statusFilter.dispatch("change");

  newerResponse.resolve(questionQueue([{
    id: "new-question",
    student_id: "student-2",
    student_name: "Newest question",
    course_key: "arboriculture_1",
    module_key: "module-2",
    question_text: "Current question",
    status: "new"
  }]));
  await newerRefresh;

  assert.match(elements.questions.innerHTML, /Newest question/);
  assert.doesNotMatch(elements.questions.innerHTML, /Stale question/);
  assert.equal(elements.message.textContent, "1 question(s).");
  assert.equal(elements.load.disabled, false);

  olderResponse.resolve(questionQueue([{
    id: "old-question",
    student_id: "student-1",
    student_name: "Stale question",
    course_key: "arboriculture_1",
    module_key: "module-1",
    question_text: "Already processed question",
    status: "new"
  }]));
  await olderRefresh;

  assert.match(elements.questions.innerHTML, /Newest question/);
  assert.doesNotMatch(elements.questions.innerHTML, /Stale question/);
  assert.equal(elements.message.textContent, "1 question(s).");
  assert.equal(elements.load.disabled, false);
});

test("stale tutor errors and empty results cannot overwrite newer messages", async () => {
  const staleError = deferred();
  const currentResponse = deferred();
  let requestCount = 0;
  const { context, elements } = await frontendContext(async () => {
    requestCount += 1;
    if (requestCount === 1) return successfulQueue();
    return requestCount === 2 ? staleError.promise : currentResponse.promise;
  });

  const olderRefresh = vm.runInContext(
    'loadQuestions("Older answer saved.")',
    context
  );
  const newerRefresh = vm.runInContext(
    'loadQuestions("Question closed successfully.")',
    context
  );

  currentResponse.resolve(questionQueue([{
    id: "current-question",
    student_id: "student-2",
    student_name: "Current student",
    course_key: "arboriculture_1",
    module_key: "module-2",
    question_text: "Still active",
    status: "new"
  }]));
  await newerRefresh;

  const currentMarkup = elements.questions.innerHTML;
  const currentMessage = elements.message.textContent;
  staleError.reject(new Error("stale tutor failure"));
  await olderRefresh;

  assert.equal(elements.questions.innerHTML, currentMarkup);
  assert.equal(elements.message.textContent, currentMessage);
  assert.equal(elements.message.textContent, "Question closed successfully.");
  assert.doesNotMatch(elements.message.textContent, /stale tutor failure/);

  context.fetch = async () => {
    throw new Error("current tutor failure");
  };
  await vm.runInContext(
    'loadQuestions("Answer saved. Student email: accepted.")',
    context
  );

  assert.equal(elements.questions.innerHTML, "");
  assert.equal(
    elements.message.textContent,
    "Answer saved. Student email: accepted. Queue refresh failed: current tutor failure"
  );
});

test("a current tutor error survives a stale empty response", async () => {
  const staleEmptyResponse = deferred();
  const currentError = deferred();
  let requestCount = 0;
  const { context, elements } = await frontendContext(async () => {
    requestCount += 1;
    if (requestCount === 1) return successfulQueue();
    return requestCount === 2
      ? staleEmptyResponse.promise
      : currentError.promise;
  });

  const olderRefresh = vm.runInContext("loadQuestions()", context);
  const newerRefresh = vm.runInContext("loadQuestions()", context);

  currentError.reject(new Error("latest tutor failure"));
  await newerRefresh;
  assert.equal(elements.message.textContent, "latest tutor failure");

  staleEmptyResponse.resolve(successfulQueue());
  await olderRefresh;
  assert.equal(elements.questions.innerHTML, "");
  assert.equal(elements.message.textContent, "latest tutor failure");
});

test("the newest tutor mutation confirmation is visible while refresh is pending", async () => {
  const pendingResponse = deferred();
  let requestCount = 0;
  const { context, elements } = await frontendContext(async () => {
    requestCount += 1;
    return requestCount === 1 ? successfulQueue() : pendingResponse.promise;
  });

  const refresh = vm.runInContext(
    'loadQuestions("Answer saved. Student email: accepted.")',
    context
  );

  assert.equal(
    elements.message.textContent,
    "Answer saved. Student email: accepted."
  );

  pendingResponse.resolve(successfulQueue());
  await refresh;
  assert.equal(
    elements.message.textContent,
    "Answer saved. Student email: accepted."
  );
});

test("parallel question mutations keep the newest real queue refresh authoritative", async () => {
  const firstMutationResponse = deferred();
  const secondMutationResponse = deferred();
  const firstRefresh = deferred();
  const secondRefresh = deferred();
  const firstButton = questionButton("q-1", "close");
  const secondButton = questionButton("q-2", "close");
  let queueRequestCount = 0;
  let mutationRequestCount = 0;
  const { context, elements } = await frontendContext(
    async (_url, options = {}) => {
      if (options.method === "POST") {
        mutationRequestCount += 1;
        return mutationRequestCount === 1
          ? firstMutationResponse.promise
          : secondMutationResponse.promise;
      }

      queueRequestCount += 1;
      if (queueRequestCount === 1) return successfulQueue();
      return queueRequestCount === 2
        ? firstRefresh.promise
        : secondRefresh.promise;
    },
    { actionControls: [firstButton, secondButton] }
  );
  Object.assign(context, { firstButton, secondButton });

  const first = vm.runInContext('closeQuestion("q-1", firstButton)', context);
  const second = vm.runInContext('closeQuestion("q-2", secondButton)', context);
  assert.equal(mutationRequestCount, 2);
  assert.equal(firstButton.disabled, true);
  assert.equal(secondButton.disabled, true);

  firstMutationResponse.resolve({
    ok: true,
    status: 200,
    async json() {
      return { ok: true };
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  secondMutationResponse.resolve({
    ok: true,
    status: 200,
    async json() {
      return { ok: true };
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(queueRequestCount, 3);

  secondRefresh.resolve(questionQueue([]));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.message.textContent, "Question closed successfully.");

  firstRefresh.resolve(questionQueue([{
    id: "q-1",
    student_id: "student-1",
    student_name: "Already closed question",
    course_key: "arboriculture_1",
    module_key: "module-1",
    question_text: "Stale active question",
    status: "new"
  }]));
  await Promise.all([first, second]);

  assert.equal(elements.questions.innerHTML, "");
  assert.equal(elements.message.textContent, "Question closed successfully.");
  assert.equal(firstButton.disabled, false);
  assert.equal(secondButton.disabled, false);
});

test("newer question success survives an older question mutation failure", async () => {
  const olderMutation = deferred();
  const newerMutation = deferred();
  const olderButton = questionButton("q-1", "close");
  const newerButton = questionButton("q-2", "close");
  let queueRequestCount = 0;
  const { context, elements } = await frontendContext(
    async (url, options = {}) => {
      if (options.method === "POST") {
        return url.endsWith("/q-1/close")
          ? olderMutation.promise
          : newerMutation.promise;
      }
      queueRequestCount += 1;
      return successfulQueue();
    },
    { actionControls: [olderButton, newerButton] }
  );
  Object.assign(context, { olderButton, newerButton });

  const older = vm.runInContext(
    'closeQuestion("q-1", olderButton)',
    context
  );
  const newer = vm.runInContext(
    'closeQuestion("q-2", newerButton)',
    context
  );

  newerMutation.resolve(successfulMutation());
  assert.equal(await newer, true);
  assert.equal(
    elements.message.textContent,
    "Question closed successfully."
  );

  olderMutation.reject(new Error("Older question failed"));
  assert.equal(await older, false);
  assert.equal(
    elements.message.textContent,
    "Question closed successfully."
  );
  assert.doesNotMatch(elements.message.textContent, /Older question failed/);
  assert.equal(queueRequestCount, 2);
});

test("newer question success survives an older timeout", async () => {
  const olderMutation = deferred();
  const newerMutation = deferred();
  const olderButton = questionButton("q-1", "close");
  const newerButton = questionButton("q-2", "close");
  let postCount = 0;
  const { context, elements } = await frontendContext(
    async (_url, options = {}) => {
      if (options.method !== "POST") return successfulQueue();
      postCount += 1;
      return postCount === 1
        ? olderMutation.promise
        : newerMutation.promise;
    },
    { actionControls: [olderButton, newerButton] }
  );
  Object.assign(context, { olderButton, newerButton });

  const older = vm.runInContext(
    'closeQuestion("q-1", olderButton)',
    context
  );
  const newer = vm.runInContext(
    'closeQuestion("q-2", newerButton)',
    context
  );

  newerMutation.resolve(successfulMutation());
  assert.equal(await newer, true);

  olderMutation.resolve({
    ok: false,
    status: 504,
    async json() {
      return {
        ok: false,
        code: "UPSTREAM_TIMEOUT",
        error: "safe timeout"
      };
    }
  });
  assert.equal(await older, false);
  assert.equal(
    elements.message.textContent,
    "Question closed successfully."
  );
  assert.doesNotMatch(elements.message.textContent, /timed out/);
  assert.equal(postCount, 2);
});

test("older question success cannot overwrite a newer mutation error", async () => {
  const olderMutation = deferred();
  const newerMutation = deferred();
  const olderButton = questionButton("q-1", "close");
  const newerButton = questionButton("q-2", "close");
  const { context, elements } = await frontendContext(
    async (url, options = {}) => {
      if (options.method === "POST") {
        return url.endsWith("/q-1/close")
          ? olderMutation.promise
          : newerMutation.promise;
      }
      return successfulQueue();
    },
    { actionControls: [olderButton, newerButton] }
  );
  Object.assign(context, { olderButton, newerButton });

  const older = vm.runInContext(
    'closeQuestion("q-1", olderButton)',
    context
  );
  const newer = vm.runInContext(
    'closeQuestion("q-2", newerButton)',
    context
  );

  newerMutation.reject(new Error("Newest question failed"));
  assert.equal(await newer, false);
  assert.equal(elements.message.textContent, "Newest question failed");

  olderMutation.resolve(successfulMutation());
  assert.equal(await older, true);
  assert.equal(elements.message.textContent, "Newest question failed");
});

test("an older refresh error cannot overwrite a newer mutation error", async () => {
  const olderMutation = deferred();
  const olderRefresh = deferred();
  const newerMutation = deferred();
  const olderButton = questionButton("q-1", "close");
  const newerButton = questionButton("q-2", "close");
  let queueRequestCount = 0;
  const { context, elements } = await frontendContext(
    async (url, options = {}) => {
      if (options.method === "POST") {
        return url.endsWith("/q-1/close")
          ? olderMutation.promise
          : newerMutation.promise;
      }
      queueRequestCount += 1;
      return queueRequestCount === 1
        ? successfulQueue()
        : olderRefresh.promise;
    },
    { actionControls: [olderButton, newerButton] }
  );
  Object.assign(context, { olderButton, newerButton });

  const older = vm.runInContext(
    'closeQuestion("q-1", olderButton)',
    context
  );
  olderMutation.resolve(successfulMutation());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(queueRequestCount, 2);

  const newer = vm.runInContext(
    'closeQuestion("q-2", newerButton)',
    context
  );
  newerMutation.reject(new Error("Newest question failed"));
  assert.equal(await newer, false);
  assert.equal(elements.message.textContent, "Newest question failed");

  olderRefresh.reject(new Error("Older refresh failed"));
  assert.equal(await older, true);
  assert.equal(elements.message.textContent, "Newest question failed");
  assert.doesNotMatch(elements.message.textContent, /Older refresh failed/);
});

test("answering and closing the same question remain single-flight with real refresh", async () => {
  const mutationResponse = deferred();
  const answerButton = questionButton("q-1", "answer");
  const closeButton = questionButton("q-1", "close");
  const answerField = element("A checked answer");
  let queueRequestCount = 0;
  let mutationRequestCount = 0;
  const { context, elements } = await frontendContext(
    async (_url, options = {}) => {
      if (options.method === "POST") {
        mutationRequestCount += 1;
        return mutationResponse.promise;
      }
      queueRequestCount += 1;
      return successfulQueue();
    },
    {
      actionControls: [answerButton, closeButton],
      extraElements: { "answer-q-1": answerField }
    }
  );
  Object.assign(context, { answerButton, closeButton });

  const answer = vm.runInContext('sendAnswer("q-1", answerButton)', context);
  const blockedClose = vm.runInContext('closeQuestion("q-1", closeButton)', context);

  assert.equal(await blockedClose, false);
  assert.equal(mutationRequestCount, 1);
  mutationResponse.resolve({
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        question: { student_notification_status: "accepted" }
      };
    }
  });
  assert.equal(await answer, true);
  assert.equal(mutationRequestCount, 1);
  assert.equal(queueRequestCount, 2);
  assert.equal(
    elements.message.textContent,
    "Answer saved. Student email: sent and accepted by the notification service."
  );
});

test("queue refresh failure keeps an answer confirmation visible", async () => {
  let calls = 0;
  const { context, elements } = await frontendContext(async () => {
    calls += 1;
    if (calls === 1) return successfulQueue();
    throw new TypeError("network unavailable");
  });

  await vm.runInContext(
    'loadQuestions("Answer saved. Student email: sent and accepted by the notification service.")',
    context
  );

  assert.equal(
    elements.message.textContent,
    "Answer saved. Student email: sent and accepted by the notification service. " +
      "Queue refresh failed: network unavailable"
  );
});

test("queue refresh timeout keeps a close confirmation visible", async () => {
  let calls = 0;
  const { context, elements } = await frontendContext(async () => {
    calls += 1;
    if (calls === 1) return successfulQueue();
    return {
      ok: false,
      status: 504,
      async json() {
        return {
          ok: false,
          code: "UPSTREAM_TIMEOUT",
          error: "safe timeout"
        };
      }
    };
  });

  await vm.runInContext(
    'loadQuestions("Question closed successfully.")',
    context
  );

  assert.equal(
    elements.message.textContent,
    "Question closed successfully. Queue refresh failed: " +
      "The request timed out. The change may already have been processed. " +
      "Refresh the queue before trying again."
  );
});

test("ordinary queue load failures still show the normal error", async () => {
  const { context, elements } = await frontendContext(async () => successfulQueue());
  context.fetch = async () => {
    throw new TypeError("network unavailable");
  };

  await vm.runInContext("loadQuestions()", context);

  assert.equal(elements.message.textContent, "network unavailable");
});

test("Send answer disables both actions and the answer field for one question", async () => {
  const answerButton = questionButton("q-1", "answer");
  const closeButton = questionButton("q-1", "close");
  const otherButton = questionButton("q-2", "close");
  const answerField = element("A checked answer");
  let finishMutation;
  const { context } = await frontendContext(
    async () => successfulQueue(),
    {
      actionControls: [answerButton, closeButton, otherButton],
      extraElements: { "answer-q-1": answerField }
    }
  );
  context.fetch = () => new Promise(resolve => {
    finishMutation = resolve;
  });

  const pending = vm.runInContext(
    'sendAnswer("q-1", answerButton)',
    Object.assign(context, { answerButton })
  );

  assert.equal(answerButton.disabled, true);
  assert.equal(closeButton.disabled, true);
  assert.equal(answerField.disabled, true);
  assert.equal(otherButton.disabled, false);

  context.loadQuestions = async () => {};
  finishMutation({
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        question: { student_notification_status: "accepted" }
      };
    }
  });
  await pending;

  assert.equal(answerButton.disabled, false);
  assert.equal(closeButton.disabled, false);
  assert.equal(answerField.disabled, false);
});

test("Close question disables both actions and the answer field for one question", async () => {
  const answerButton = questionButton("q-1", "answer");
  const closeButton = questionButton("q-1", "close");
  const answerField = element("Draft answer");
  let finishMutation;
  const { context } = await frontendContext(
    async () => successfulQueue(),
    {
      actionControls: [answerButton, closeButton],
      extraElements: { "answer-q-1": answerField }
    }
  );
  context.fetch = () => new Promise(resolve => {
    finishMutation = resolve;
  });

  const pending = vm.runInContext(
    'closeQuestion("q-1", closeButton)',
    Object.assign(context, { closeButton })
  );

  assert.equal(answerButton.disabled, true);
  assert.equal(closeButton.disabled, true);
  assert.equal(answerField.disabled, true);

  context.loadQuestions = async () => {};
  finishMutation({
    ok: true,
    status: 200,
    async json() {
      return { ok: true };
    }
  });
  await pending;

  assert.equal(answerButton.disabled, false);
  assert.equal(closeButton.disabled, false);
  assert.equal(answerField.disabled, false);
});

test("Send answer followed by Close question sends one mutation", async () => {
  const answerButton = questionButton("q-1", "answer");
  const closeButton = questionButton("q-1", "close");
  const answerField = element("A checked answer");
  let mutationCount = 0;
  let finishMutation;
  const { context } = await frontendContext(
    async () => successfulQueue(),
    {
      actionControls: [answerButton, closeButton],
      extraElements: { "answer-q-1": answerField }
    }
  );
  context.fetch = () => {
    mutationCount += 1;
    return new Promise(resolve => {
      finishMutation = resolve;
    });
  };

  const first = vm.runInContext(
    'sendAnswer("q-1", answerButton)',
    Object.assign(context, { answerButton, closeButton })
  );
  const blocked = vm.runInContext('closeQuestion("q-1", closeButton)', context);

  assert.equal(await blocked, false);
  assert.equal(mutationCount, 1);

  context.loadQuestions = async () => {};
  finishMutation({
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        question: { student_notification_status: "accepted" }
      };
    }
  });
  await first;
  assert.equal(mutationCount, 1);
});

test("Close question followed by Send answer sends one mutation", async () => {
  const answerButton = questionButton("q-1", "answer");
  const closeButton = questionButton("q-1", "close");
  const answerField = element("A checked answer");
  let mutationCount = 0;
  let finishMutation;
  const { context } = await frontendContext(
    async () => successfulQueue(),
    {
      actionControls: [answerButton, closeButton],
      extraElements: { "answer-q-1": answerField }
    }
  );
  context.fetch = () => {
    mutationCount += 1;
    return new Promise(resolve => {
      finishMutation = resolve;
    });
  };

  const first = vm.runInContext(
    'closeQuestion("q-1", closeButton)',
    Object.assign(context, { answerButton, closeButton })
  );
  const blocked = vm.runInContext('sendAnswer("q-1", answerButton)', context);

  assert.equal(await blocked, false);
  assert.equal(mutationCount, 1);

  context.loadQuestions = async () => {};
  finishMutation({
    ok: true,
    status: 200,
    async json() {
      return { ok: true };
    }
  });
  await first;
  assert.equal(mutationCount, 1);
});

test("a fast double click on Send answer sends one mutation", async () => {
  const answerButton = questionButton("q-1", "answer");
  const closeButton = questionButton("q-1", "close");
  const answerField = element("A checked answer");
  let mutationCount = 0;
  let finishMutation;
  const { context } = await frontendContext(
    async () => successfulQueue(),
    {
      actionControls: [answerButton, closeButton],
      extraElements: { "answer-q-1": answerField }
    }
  );
  context.fetch = () => {
    mutationCount += 1;
    return new Promise(resolve => {
      finishMutation = resolve;
    });
  };

  const first = vm.runInContext(
    'sendAnswer("q-1", answerButton)',
    Object.assign(context, { answerButton })
  );
  const blocked = vm.runInContext('sendAnswer("q-1", answerButton)', context);

  assert.equal(await blocked, false);
  assert.equal(mutationCount, 1);

  context.loadQuestions = async () => {};
  finishMutation({
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        question: { student_notification_status: "accepted" }
      };
    }
  });
  await first;
  assert.equal(mutationCount, 1);
});

test("question in-flight state is cleaned up after success and failure", async () => {
  const button = questionButton("q-1", "close");
  const { context, elements } = await frontendContext(
    async () => successfulQueue(),
    { actionControls: [button] }
  );
  let mutationCount = 0;

  context.loadQuestions = async () => {};
  context.fetch = async () => {
    mutationCount += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true };
      }
    };
  };
  Object.assign(context, { button });

  assert.equal(await vm.runInContext('closeQuestion("q-1", button)', context), true);
  assert.equal(button.disabled, false);

  context.fetch = async () => {
    mutationCount += 1;
    throw new Error("Mutation failed");
  };
  assert.equal(await vm.runInContext('closeQuestion("q-1", button)', context), false);
  assert.equal(button.disabled, false);
  assert.equal(elements.message.textContent, "Mutation failed");

  context.fetch = async () => {
    mutationCount += 1;
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true };
      }
    };
  };
  assert.equal(await vm.runInContext('closeQuestion("q-1", button)', context), true);
  assert.equal(mutationCount, 3);
});

test("different questions can mutate independently", async () => {
  const firstButton = questionButton("q-1", "close");
  const secondButton = questionButton("q-2", "close");
  const resolvers = new Map();
  const mutationUrls = [];
  const { context } = await frontendContext(
    async () => successfulQueue(),
    { actionControls: [firstButton, secondButton] }
  );

  context.loadQuestions = async () => {};
  context.fetch = url => {
    mutationUrls.push(url);
    return new Promise(resolve => {
      resolvers.set(url, resolve);
    });
  };
  Object.assign(context, { firstButton, secondButton });

  const first = vm.runInContext('closeQuestion("q-1", firstButton)', context);
  const second = vm.runInContext('closeQuestion("q-2", secondButton)', context);

  assert.equal(mutationUrls.length, 2);
  assert.equal(firstButton.disabled, true);
  assert.equal(secondButton.disabled, true);

  resolvers.get(mutationUrls[0])({
    ok: true,
    status: 200,
    async json() {
      return { ok: true };
    }
  });
  await first;
  assert.equal(firstButton.disabled, false);
  assert.equal(secondButton.disabled, true);

  resolvers.get(mutationUrls[1])({
    ok: true,
    status: 200,
    async json() {
      return { ok: true };
    }
  });
  await second;
  assert.equal(secondButton.disabled, false);
});

test("a tutor mutation timeout is not retried and keeps the existing warning", async () => {
  const button = questionButton("q-1", "close");
  let mutationCount = 0;
  let refreshCount = 0;
  const { context, elements } = await frontendContext(
    async () => successfulQueue(),
    { actionControls: [button] }
  );

  context.fetch = async () => {
    mutationCount += 1;
    return {
      ok: false,
      status: 504,
      async json() {
        return {
          ok: false,
          code: "UPSTREAM_TIMEOUT",
          error: "safe timeout"
        };
      }
    };
  };
  context.loadQuestions = async () => {
    refreshCount += 1;
  };
  Object.assign(context, { button });

  assert.equal(await vm.runInContext('closeQuestion("q-1", button)', context), false);
  assert.equal(mutationCount, 1);
  assert.equal(refreshCount, 0);
  assert.equal(
    elements.message.textContent,
    "The request timed out. The change may already have been processed. " +
      "Refresh the queue before trying again."
  );
});
