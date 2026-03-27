import { useEffect, useState } from "react";

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
    <div className="clock-card">
      <div className="clock-time">
        {hh}:{mm}
        <span className="clock-seconds">:{ss}</span>
      </div>
      <div className="clock-meta">
        <span>{dateStr}</span>
        <span className="clock-zone">Madrid</span>
      </div>
    </div>
  );
}
