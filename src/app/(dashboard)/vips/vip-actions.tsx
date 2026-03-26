"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface VipActionsProps {
  readonly vipId: string;
}

export function VipApproveReject({ vipId }: VipActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "approve" | "reject") {
    setLoading(true);
    try {
      const res = await fetch("/api/vips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vipId, action }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleAction("approve")}
        disabled={loading}
        className="rounded-md bg-sage-200 px-3 py-1.5 text-xs font-medium text-gray-900 transition-colors hover:bg-sage-300 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        onClick={() => handleAction("reject")}
        disabled={loading}
        className="rounded-md bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}

export function VipDeactivate({ vipId }: VipActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/vips", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vipId, action: "toggle" }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
    >
      Deactivate
    </button>
  );
}
