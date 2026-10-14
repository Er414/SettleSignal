"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const SettlementScene = dynamic(() => import("./SettlementScene"), { ssr: false });

export function SceneFrame({
  variant = "hero",
  confirmed = false,
}: {
  variant?: "hero" | "compact";
  confirmed?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    try {
      const canvas = document.createElement("canvas");
      setWebgl(Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
    } catch {
      setWebgl(false);
    }
    const node = frame.current;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting && document.visibilityState === "visible"), {
      threshold: 0.15,
    });
    if (node) observer.observe(node);
    const onVisibility = () => setActive((node ? true : false) && document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      media.removeEventListener("change", update);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const caption = confirmed
    ? "A live Arc verification is on record in this workspace."
    : "Conceptual illustration. A finished animation is not a payment confirmation.";

  return (
    <div ref={frame} className={`scene-frame ${variant === "compact" ? "compact" : ""}`}>
      <div className="scene-kicker">{confirmed ? "Verified signal" : "Settlement in motion"}</div>
      {reduced || !webgl ? (
        <div className="scene-fallback">
          <img src={variant === "compact" ? "/images/signal-still.jpg" : "/images/hero-poster.jpg"} alt="Glass settlement ring in a dark studio, shown as a still because motion is reduced or WebGL is unavailable." />
        </div>
      ) : (
        <SettlementScene variant={variant} confirmed={confirmed} active={active && !reduced} />
      )}
      <div className="scene-caption">
        <span>{caption}</span>
        {variant === "hero" ? (
          <span className="legend">
            <b>Open</b>
            <b>Path</b>
            <b>Confirmed</b>
          </span>
        ) : null}
      </div>
    </div>
  );
}
