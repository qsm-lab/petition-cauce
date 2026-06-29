"use client";

import { useState, useEffect } from "react";

interface UseTypewriterResult {
  displayed: string;
  done: boolean;
}

export function useTypewriter(text: string, speed = 30): UseTypewriterResult {
  // SSR-safe: always start empty — useEffect sets the correct value on client
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || !text) {
      setDisplayed(text);
      setDone(true);
      return;
    }

    setDisplayed("");
    setDone(false);

    let index = 0;
    const id = setInterval(() => {
      index += 1;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(id);
  }, [text, speed]);

  return { displayed, done };
}
