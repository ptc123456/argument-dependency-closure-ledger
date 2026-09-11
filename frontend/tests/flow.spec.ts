import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResponseActions } from "../src/ResponseActions";
import { actionsForPhase } from "../src/workflow";

describe("complete case journey", () => {
  it("keeps every required write reachable in phase order", () => {
    expect(actionsForPhase()).toEqual(["create_graph"]);
    expect(actionsForPhase("BASE_DRAFT")).toEqual(["replace_graph", "lock_graph"]);
    expect(actionsForPhase("BASE_LOCKED")).toEqual(["put_replies"]);
    expect(actionsForPhase("RESPONSE_DRAFT")).toEqual(["put_replies", "freeze_replies"]);
    expect(actionsForPhase("FROZEN")).toEqual(["evaluate_closure"]);
    expect(actionsForPhase("UNRESOLVED")).toEqual(["retry_closure"]);
    expect(actionsForPhase("DONE")).toEqual([]);
  });

  it("renders both response actions in RESPONSE_DRAFT", () => {
    const html = renderToStaticMarkup(createElement(ResponseActions, { phase: "RESPONSE_DRAFT", canWrite: true, onWrite: () => undefined }));
    expect(html).toContain("Save response draft");
    expect(html).toContain("Freeze replies");
    expect(html).not.toContain("disabled");
  });
});
