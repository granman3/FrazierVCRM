"use client";

import { useState } from "react";

export function PipelineTrigger() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");

  async function handleTrigger() {
    setStatus("running");
    try {
      const res = await fetch("/api/pipeline/trigger", { method: "POST" });
      if (res.ok) {
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleTrigger}
        disabled={status === "running"}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {status === "running" ? "Running..." : "Run Pipeline Now"}
      </button>
      {status === "done" && (
        <span className="text-sm text-green-600">Pipeline started. Check run history for results.</span>
      )}
      {status === "error" && (
        <span className="text-sm text-red-600">Failed to start pipeline.</span>
      )}
    </div>
  );
}
