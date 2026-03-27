import { useState, useEffect } from "react";

export function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hh = String(time.getHours()).padStart(2, "0");
  const mm = String(time.getMinutes()).padStart(2, "0");
  const ss = String(time.getSeconds()).padStart(2, "0");

  const dateStr = time.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="font-display font-bold text-white tracking-tight" style={{ fontSize: "2.2rem", lineHeight: 1 }}>
        {hh}:{mm}
        <span style={{ color: "#8b9cf7" }}>:{ss}</span>
      </div>
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>{dateStr}</div>
    </div>
  );
}
