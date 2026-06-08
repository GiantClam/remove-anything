"use client";

import { useEffect, useState } from "react";

const messages = [
  "Preparing your edit",
  "Refining the selection",
  "Removing the object",
  "Blending the background naturally",
];

export function RemoveObjectsComforting() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, 2200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-medium text-foreground">{messages[index]}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Usually around 40 seconds, sometimes a bit longer depending on image
        size and object complexity.
      </p>
    </div>
  );
}
