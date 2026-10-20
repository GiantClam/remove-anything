"use client";

import { useState } from "react";

const taskTypes = [
  ["image", "Image task"],
  ["background", "Background removal"],
  ["object", "Object removal"],
  ["watermark", "Watermark removal"],
  ["video", "Video task"],
] as const;

type RequestState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "submitted"; requestId: string }
  | { kind: "error"; message: string };

export function DeletionRequestForm() {
  const [state, setState] = useState<RequestState>({ kind: "idle" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "submitting" });
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/privacy/deletion-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          taskType: form.get("taskType"),
          taskId: form.get("taskId"),
          details: form.get("details"),
          website: form.get("website"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setState({
          kind: "error",
          message:
            response.status === 429
              ? "Too many requests. Please try again later."
              : "The request could not be submitted. Please email support@remove-anything.com.",
        });
        return;
      }
      setState({ kind: "submitted", requestId: result.requestId });
      event.currentTarget.reset();
    } catch {
      setState({
        kind: "error",
        message:
          "The request could not be submitted. Please email support@remove-anything.com.",
      });
    }
  }

  if (state.kind === "submitted") {
    return (
      <p role="status" className="mt-4 rounded-md border p-4 leading-7">
        Request received. Keep reference <strong>{state.requestId}</strong>.
        Support will verify the request and confirm what can be deleted.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 grid max-w-2xl gap-4">
      <label className="grid gap-2">
        <span>Email for follow-up</span>
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          maxLength={254}
          className="min-h-10 rounded border bg-background px-3"
        />
      </label>
      <label className="grid gap-2">
        <span>Task type</span>
        <select
          required
          name="taskType"
          defaultValue="image"
          className="min-h-10 rounded border bg-background px-3"
        >
          {taskTypes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2">
        <span>Task ID</span>
        <input
          required
          name="taskId"
          maxLength={80}
          autoComplete="off"
          className="min-h-10 rounded border bg-background px-3"
        />
      </label>
      <label className="grid gap-2">
        <span>Additional details (optional)</span>
        <textarea
          name="details"
          rows={3}
          maxLength={500}
          className="rounded border bg-background px-3 py-2"
        />
      </label>
      <label
        aria-hidden="true"
        className="absolute -left-[10000px] h-px w-px overflow-hidden"
      >
        <span>Leave this field blank</span>
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <p className="text-sm text-muted-foreground">
        This sends a request for support review; it does not immediately delete
        files. We may ask you to verify ownership and may retain records where
        required by law.
      </p>
      <button
        type="submit"
        disabled={state.kind === "submitting"}
        className="min-h-10 w-fit rounded border px-4 font-medium disabled:opacity-60"
      >
        {state.kind === "submitting" ? "Submitting…" : "Request early deletion"}
      </button>
      {state.kind === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
