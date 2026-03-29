import { useState, useEffect, useRef, useCallback } from "react";

// ─── HTML SANITISER ────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── TYPES ────────────────────────────────────────────────────────────────
interface RecentReview {
  rating: number;
  isoDate: string;
  text: string;
  author: string;
}

interface DashboardData {
  netScore: number;
  positive: number;
  negative: number;
  objective: number;
  allTimePositive: number;
  allTimeNegative: number;
  allTimeTotal: number;
  googleTotalReviews: number;
  googleAvgRating: number;
  trimesterName: string;
  trimesterStart: string;
  trimesterEnd: string;
  recentActivity: RecentReview[];
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────────
const MOTIV = [
  "Un cliente satisfecho es el mejor comercial que existe.",
  "Cada llamada resuelta es una reseña de 5 estrellas esperando.",
  "¡Sois el equipo que puede lograrlo — 270 reseñas este trimestre!",
  "Resuelve rápido, fideliza para siempre.",
  "La próxima reseña puede llegar de tu próxima llamada.",
  "Trato excelente → cliente feliz → reseña en Google.",
];

// ─── HELPERS ───────────────────────────────────────────────────────────────
function nameToHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgoES(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2) return "ahora mismo";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "hace 1 día";
  if (diffD < 30) return `hace ${diffD} días`;
  const diffW = Math.floor(diffD / 7);
  if (diffW < 6) return `hace ${diffW} semanas`;
  const diffMo = Math.floor(diffD / 30);
  return `hace ${diffMo} meses`;
}

function daysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
  return Math.max(0, diff);
}

function daysUntilStart(startDate: string): number {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.ceil((start.getTime() - today.getTime()) / 86400000);
  return Math.max(0, diff);
}

function formatStartDate(isoDate: string): string {
  const ES_MONTHS = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  const d = new Date(isoDate);
  return `${d.getDate()} ${ES_MONTHS[d.getMonth()]}`;
}

function quarterRange(start: string, end: string): string {
  const ES_MONTHS = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  const s = new Date(start);
  const e = new Date(end);
  return `${ES_MONTHS[s.getMonth()]} – ${ES_MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}

function toReviewCards(reviews: RecentReview[]) {
  return reviews.map((r, i) => {
    const hue = nameToHue(r.author);
    const sat = 55 + (hue % 20);
    const lit = 38 + (hue % 20);
    return {
      id: i,
      name: r.author,
      ini: initials(r.author),
      hue,
      sat: `${sat}%`,
      lit: `${lit}%`,
      r: r.rating,
      t: timeAgoES(r.isoDate),
      txt: stripHtml(r.text) || "Cliente de Eltex Solar.",
    };
  });
}

// ─── LIVE DATA HOOK ────────────────────────────────────────────────────────
const API_REST = "/api/dashboard";
const API_SSE  = "/api/dashboard/stream";

function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);
  const esRef      = useRef<EventSource | null>(null);
  const retryRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connectSSE = useCallback(() => {
    if (!mountedRef.current) return;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    const es = new EventSource(API_SSE);
    esRef.current = es;

    es.addEventListener("dashboard", (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        setData(JSON.parse(e.data));
        setError(false);
      } catch {/* ignore parse errors */}
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (!mountedRef.current) return;
      // Fall back to REST poll, then retry SSE in 30 s
      fetch(API_REST)
        .then(r => r.json())
        .then(d => { if (mountedRef.current) { setData(d); setError(false); } })
        .catch(() => { if (mountedRef.current) setError(true); });
      retryRef.current = setTimeout(connectSSE, 30000);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Initial REST load for fast first paint
    fetch(API_REST)
      .then(r => r.json())
      .then(d => { if (mountedRef.current) { setData(d); setError(false); } })
      .catch(() => { if (mountedRef.current) setError(true); });

    // Then upgrade to SSE
    connectSSE();

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      esRef.current = null;
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };
  }, [connectSSE]);

  return { data, error };
}

// ─── STAR PATH ─────────────────────────────────────────────────────────────
const SP = "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

function Star({ s = 16, on = true }: { s?: number; on?: boolean }) {
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill={on ? "#F59E0B" : "rgba(255,255,255,0.10)"} style={{ flexShrink: 0 }}>
      <path d={SP}/>
    </svg>
  );
}

// Whole-number stars used in review cards (n is always 1-5)
function Stars({ n, s = 16, gap = 3 }: { n: number; s?: number; gap?: number }) {
  return (
    <span style={{ display: "inline-flex", gap, alignItems: "center" }}>
      {[1,2,3,4,5].map(i => <Star key={i} s={s} on={i <= n}/>)}
    </span>
  );
}

// Fractional star — renders exactly `fill` (0–1) of the star filled in amber
function StarFill({ s = 16, fill = 1, uid }: { s?: number; fill?: number; uid: string }) {
  const clipId = `clip-${uid}`;
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" style={{ flexShrink: 0, overflow: "visible" }}>
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={20 * fill} height="20"/>
        </clipPath>
      </defs>
      <path d={SP} fill="rgba(255,255,255,0.10)"/>
      <path d={SP} fill="#F59E0B" clipPath={`url(#${clipId})`}/>
    </svg>
  );
}

// Fractional rating stars — accurately represents e.g. 4.6 as 4 full + 0.6 partial star
function RatingStars({ rating, s = 16, gap = 3 }: { rating: number; s?: number; gap?: number }) {
  return (
    <span style={{ display: "inline-flex", gap, alignItems: "center" }}>
      {[1,2,3,4,5].map(i => {
        const fill = Math.min(1, Math.max(0, rating - (i - 1)));
        return <StarFill key={i} s={s} fill={fill} uid={`rating-${Math.round(rating * 10)}-${i}`}/>;
      })}
    </span>
  );
}

function GIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Google" role="img" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ─── HOOKS ─────────────────────────────────────────────────────────────────
function useCountUp(target: number, ms = 1800) {
  const [v, setV] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    let start: number | null = null;
    let raf: number;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / ms, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = Math.round(from + eased * (target - from));
      setV(cur);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

// ─── CLOCK ─────────────────────────────────────────────────────────────────
function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const p  = (n: number) => String(n).padStart(2, "0");
  const DD = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];
  const MM = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: "-2px", lineHeight: 1, color: "var(--text-1)" }}>
        {p(t.getHours())}:{p(t.getMinutes())}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", color: "var(--text-3)", marginTop: 4, textTransform: "uppercase" }}>
        {DD[t.getDay()]} · {t.getDate()} {MM[t.getMonth()]} {t.getFullYear()}
      </div>
    </div>
  );
}

// ─── PROGRESS BAR ──────────────────────────────────────────────────────────
function ProgressBar({ pct, height = 8 }: { pct: number; height?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setW(Math.min(pct, 100)), 600);
    return () => clearTimeout(id);
  }, [pct]);
  return (
    <div style={{ height, borderRadius: 99, overflow: "hidden", background: "var(--divider)", position: "relative" }}>
      <div style={{
        height: "100%", width: `${w}%`, borderRadius: 99,
        background: "linear-gradient(90deg, #4338CA 0%, #818CF8 100%)",
        transition: "width 2s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative", overflow: "hidden",
      }}>
        {w > 4 && <div className="bar-shimmer"/>}
        {w > 2 && (
          <div style={{
            position: "absolute", inset: "1px 0 0", borderRadius: 99,
            background: "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, transparent 60%)",
            pointerEvents: "none",
          }}/>
        )}
      </div>
    </div>
  );
}

// ─── ARC GAUGE ─────────────────────────────────────────────────────────────
function ArcGauge({ value, total, size = 360 }: { value: number; total: number; size?: number }) {
  const cx  = size / 2;
  const cy  = size / 2;
  const R   = size / 2 - 32;
  const SW  = 22;
  const pct = Math.min(value / Math.max(total, 1), 1);

  const pt = (deg: number): [number, number] => {
    const rad = (deg - 90) * Math.PI / 180;
    return [cx + R * Math.cos(rad), cy + R * Math.sin(rad)];
  };

  function pt_r(deg: number, r: number): [number, number] {
    const rad = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  const [sx, sy] = pt(225);
  const [ex, ey] = pt(135);
  const trackD = `M ${sx} ${sy} A ${R} ${R} 0 1 1 ${ex} ${ey}`;

  const fillEndDeg = 225 + pct * 270;
  const fillSpan   = pct * 270;
  const [fxT, fyT] = pt(fillEndDeg);
  const fillD = pct > 0.002
    ? `M ${sx} ${sy} A ${R} ${R} 0 ${fillSpan > 180 ? 1 : 0} 1 ${fxT} ${fyT}`
    : null;

  const tipRef   = useRef<SVGCircleElement>(null);
  const haloRef  = useRef<SVGCircleElement>(null);
  const shineRef = useRef<SVGCircleElement>(null);
  const animRef  = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const duration = 2200;
    const easeOutBack = (t: number) => {
      const c1 = 1.2, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };
    const startDeg = 225;
    const endDeg   = 225 + pct * 270;
    startRef.current = null;

    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const prog = Math.min((ts - startRef.current) / duration, 1);
      const easedProg = pct < 0.15 ? prog : easeOutBack(prog);
      const curDeg = startDeg + easedProg * (endDeg - startDeg);
      const [cx2, cy2] = pt(curDeg);
      tipRef.current?.setAttribute("cx", String(cx2));
      tipRef.current?.setAttribute("cy", String(cy2));
      haloRef.current?.setAttribute("cx", String(cx2));
      haloRef.current?.setAttribute("cy", String(cy2));
      shineRef.current?.setAttribute("cx", String(cx2));
      shineRef.current?.setAttribute("cy", String(cy2));
      if (prog < 1) animRef.current = requestAnimationFrame(tick);
    };

    const delay = setTimeout(() => { animRef.current = requestAnimationFrame(tick); }, 500);
    return () => {
      clearTimeout(delay);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [pct]);

  const [dash, setDash] = useState(100);
  useEffect(() => {
    const id = setTimeout(() => setDash(100 - pct * 100), 500);
    return () => clearTimeout(id);
  }, [pct]);

  const milestones = [0.25, 0.5, 0.75].map(m => {
    const deg = 225 + m * 270;
    const inner = pt_r(deg, R - SW / 2 - 6);
    const outer = pt_r(deg, R + SW / 2 + 6);
    return { inner, outer };
  });

  const isNearGoal = pct > 0.8;
  const tipX0 = sx;
  const tipY0 = sy;

  return (
    <svg width={size} height={size} style={{ overflow: "visible" }} className={isNearGoal ? "arc-glow" : ""}>
      <defs>
        <linearGradient id="arcFill" x1={sx} y1={sy} x2={ex} y2={ey} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#4338CA"/>
          <stop offset="55%"  stopColor="#6366F1"/>
          <stop offset="100%" stopColor="#818CF8"/>
        </linearGradient>
        <linearGradient id="arcTrack" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.10)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0.06)"/>
        </linearGradient>
        <filter id="tipGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="fillGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <path d={trackD} fill="none" stroke="url(#arcTrack)" strokeWidth={SW} strokeLinecap="round"/>
      <path d={trackD} fill="none" stroke="rgba(180,180,210,0.22)" strokeWidth={SW - 10} strokeLinecap="round"/>

      {milestones.map(({ inner, outer }, i) => (
        <line key={i} x1={inner[0]} y1={inner[1]} x2={outer[0]} y2={outer[1]}
          stroke="rgba(255,255,255,0.9)" strokeWidth={2} strokeLinecap="round"/>
      ))}

      {fillD && <>
        <path d={fillD} fill="none" stroke="url(#arcFill)" strokeWidth={SW + 14} strokeLinecap="round"
          pathLength="100" strokeDasharray="100" strokeDashoffset={dash} opacity="0.18"
          filter="url(#fillGlow)"
          style={{ transition: `stroke-dashoffset ${pct < 0.15 ? 2 : 2.2}s ${pct < 0.15 ? "linear" : "cubic-bezier(0.4,0,0.2,1)"}` }}
        />
        <path d={fillD} fill="none" stroke="url(#arcFill)" strokeWidth={SW} strokeLinecap="round"
          pathLength="100" strokeDasharray="100" strokeDashoffset={dash}
          style={{ transition: `stroke-dashoffset ${pct < 0.15 ? 2 : 2.2}s ${pct < 0.15 ? "linear" : "cubic-bezier(0.4,0,0.2,1)"}` }}
        />
      </>}

      <circle cx={sx} cy={sy} r={SW / 2} fill={fillD ? "#4338CA" : "#CACAD4"}/>

      {pct > 0.002 && <>
        <circle ref={haloRef} cx={tipX0} cy={tipY0} r={SW / 2 + 7}
          fill="none" stroke="#6366F1" strokeWidth={2} opacity={0.35}/>
        <circle ref={tipRef} cx={tipX0} cy={tipY0} r={SW / 2 + 2}
          fill="url(#arcFill)" filter="url(#tipGlow)"/>
        <circle ref={shineRef} cx={tipX0} cy={tipY0} r={SW / 2 - 4}
          fill="rgba(255,255,255,0.25)" style={{ pointerEvents: "none" }}/>
      </>}
    </svg>
  );
}

// ─── MOTIVATIONAL LINE ─────────────────────────────────────────────────────
function MotivLine() {
  const [idx, setIdx] = useState(0);
  const [key, setKey] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setIdx(i => (i + 1) % MOTIV.length);
      setKey(k => k + 1);
    }, 9000);
    return () => clearInterval(id);
  }, []);
  return (
    <p key={key} className="m-fade" style={{
      margin: 0, padding: "0 20px",
      fontSize: 15, fontWeight: 400, fontStyle: "italic",
      color: "var(--text-2)", lineHeight: 1.7,
      textAlign: "center", letterSpacing: "-0.005em",
      maxWidth: 440,
    }}>
      "{MOTIV[idx]}"
    </p>
  );
}

// ─── REVIEW CARD ───────────────────────────────────────────────────────────
interface ReviewItem {
  id: number;
  name: string;
  ini: string;
  hue: number;
  sat: string;
  lit: string;
  r: number;
  t: string;
  txt: string;
}

function ReviewCard({ review, cls }: { review: ReviewItem; cls: string }) {
  const avatarBg = `hsl(${review.hue}, ${review.sat}, ${review.lit})`;
  const avatarShadow = `hsl(${review.hue}, ${review.sat}, ${review.lit}, 0.35)`;
  return (
    <div className={cls} style={{
      background: "var(--white)", borderRadius: 22,
      border: "1px solid var(--divider)", padding: "32px 34px 30px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.03), 0 8px 32px rgba(0,0,0,0.06)",
    }}>
      <div style={{
        fontFamily: "Georgia, serif", fontSize: 72, lineHeight: 0.75,
        color: `hsl(${review.hue}, ${review.sat}, 92%)`,
        marginBottom: 12, marginLeft: -4, userSelect: "none", height: 40, overflow: "hidden",
      }}>"</div>
      <p style={{
        margin: "0 0 28px", fontSize: 16.5, fontWeight: 400, lineHeight: 1.8,
        color: "var(--text-1)", letterSpacing: "-0.01em",
        display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 6,
        overflow: "hidden",
      }}>
        {review.txt}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 46, height: 46, borderRadius: "50%",
          background: avatarBg, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, flexShrink: 0,
          boxShadow: `0 3px 14px ${avatarShadow}`,
        }}>
          {review.ini}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.01em" }}>{review.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Stars n={review.r} s={13} gap={2}/>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)" }}>{review.t}</span>
          </div>
        </div>
        <div style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
          padding: "7px 13px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--divider)",
        }}>
          <GIcon size={14}/>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>Google</span>
        </div>
      </div>
    </div>
  );
}

// ─── STAT CHIP ─────────────────────────────────────────────────────────────
function StatChip({ label, value, bg, border, labelColor, valColor, subtext, subtextColor }: {
  label: string; value: string | number; bg: string; border: string;
  labelColor: string; valColor: string; subtext: string; subtextColor: string;
}) {
  return (
    <div style={{ flex: 1, padding: "18px 20px", background: bg, borderRadius: 18, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: labelColor, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: "-1.5px", lineHeight: 1, color: valColor }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: subtextColor, marginTop: 7 }}>{subtext}</div>
    </div>
  );
}

// ─── LOADING SCREEN ────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "var(--bg)", gap: 20,
    }}>
      <img src="https://uploads.onecompiler.io/4454edy2w/44da2r4qv/Eltex_Logo_Positive-e1744210383227-scaled%20(4).png"
        alt="Eltex" style={{ height: 36, opacity: 0.5 }}/>
      <div style={{ display: "flex", gap: 8 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: "50%", background: "var(--accent)",
            animation: `livepulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}/>
        ))}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 500 }}>Cargando datos…</div>
    </div>
  );
}

// ─── APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const { data, error } = useDashboard();

  const [revIdx, setRevIdx] = useState(0);
  const [revCls, setRevCls] = useState("r-in");

  // Derive display values
  const GOAL          = data?.objective ?? 270;
  const PROGRESS      = data?.netScore ?? 0;
  const RATING        = data?.googleAvgRating ?? 4.6;
  const TOTAL         = data?.googleTotalReviews ?? 0;
  const _rawPositive  = data?.allTimePositive ?? 0;
  const _rawNegative  = data?.allTimeNegative ?? 0;
  const _rawPosNeg    = _rawPositive + _rawNegative;
  const POSITIVE      = _rawPosNeg > 0 && TOTAL > 0
    ? Math.round(TOTAL * _rawPositive / _rawPosNeg)
    : _rawPositive;
  const NEGATIVE      = _rawPosNeg > 0 && TOTAL > 0
    ? TOTAL - POSITIVE
    : _rawNegative;
  const DAYS          = daysRemaining(data?.trimesterEnd ?? "2026-06-30");
  const PRE_Q2        = data ? new Date() < new Date(data.trimesterStart) : false;
  const DAYS_TO_START = data ? daysUntilStart(data.trimesterStart) : 0;
  const START_LABEL   = data ? formatStartDate(data.trimesterStart) : "";
  // Pace in reviews per WEEK (weekly targets are more actionable for a team)
  // When pre-Q2: base on full Q2 duration (DAYS minus days until start)
  // When in-Q2:  base on remaining days in the quarter
  const Q2_TOTAL_WEEKS  = Math.max(Math.ceil((DAYS - DAYS_TO_START) / 7), 1);
  const WEEKS_LEFT      = Math.max(Math.ceil(DAYS / 7), 1);
  const PACE            = PRE_Q2
    ? Math.round(GOAL / Q2_TOTAL_WEEKS)
    : DAYS > 0 ? Math.max(0, Math.round((GOAL - PROGRESS) / WEEKS_LEFT)) : 0;
  const Q             = {
    label: data?.trimesterName ?? "Q2 2026",
    range: data ? quarterRange(data.trimesterStart, data.trimesterEnd) : "ABR – JUN 2026",
  };

  const reviewList = toReviewCards(data?.recentActivity ?? []);

  const remaining = Math.max(0, GOAL - PROGRESS);
  const pct = Math.round((PROGRESS / Math.max(GOAL, 1)) * 100);

  const cntTotal = useCountUp(TOTAL, 1600);
  const cntPos   = useCountUp(POSITIVE, 2000);

  useEffect(() => {
    if (reviewList.length === 0) return;
    const id = setInterval(() => {
      setRevCls("r-out");
      setTimeout(() => {
        setRevIdx(i => (i + 1) % reviewList.length);
        setRevCls("r-in");
      }, 350);
    }, 14000);
    return () => clearInterval(id);
  }, [reviewList.length]);

  if (!data && !error) return <LoadingScreen/>;

  if (error && !data) {
    return (
      <div style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 15, color: "var(--text-2)", fontWeight: 600 }}>Sin conexión al servidor</div>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>Reintentando…</div>
      </div>
    );
  }

  const currentReview = reviewList[revIdx] ?? {
    id: 0, name: "Cliente Eltex", ini: "CE", hue: 239, sat: "65%", lit: "60%",
    r: 5, t: "reciente", txt: "Excelente servicio y atención al cliente.",
  };

  return (
    <div style={{
      width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
      background: "var(--bg)", fontFamily: "Inter, system-ui, sans-serif", overflow: "hidden",
    }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header aria-label="Eltex Reviews Dashboard" style={{
        height: 68, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 52px", background: "var(--white)",
        borderBottom: "1px solid var(--divider)",
        boxShadow: "0 1px 0 var(--divider), 0 2px 8px rgba(0,0,0,0.03)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src="https://uploads.onecompiler.io/4454edy2w/44da2r4qv/Eltex_Logo_Positive-e1744210383227-scaled%20(4).png"
            alt="Eltex" style={{ height: 34, objectFit: "contain" }}/>
          <div style={{ width: 1, height: 28, background: "var(--divider)" }}/>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, color: "var(--text-1)" }}>
              Panel de Reseñas
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginTop: 2 }}>
              Experiencia del Cliente · Google Reviews
            </div>
          </div>
        </div>

        <div aria-label={`${Q.label} – ${Q.range}, en tiempo real`} style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--accent-light)", border: "1px solid rgba(129,140,248,0.28)",
          borderRadius: 100, padding: "10px 22px",
        }}>
          <div aria-hidden="true" className="live" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent-mid)" }}/>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.01em" }}>{Q.label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", background: "rgba(129,140,248,0.18)", borderRadius: 100, padding: "3px 11px" }}>
            {Q.range}
          </span>
        </div>

        <Clock/>
      </header>

      {/* ══ BODY ════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <aside aria-label="Métricas de Google Reviews" style={{
          width: 300, flexShrink: 0, background: "var(--bg-panel)",
          borderRight: "1px solid var(--divider)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>

          {/* Google Rating hero */}
          <div style={{ padding: "28px 30px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <GIcon size={15}/>
              <span className="lbl">Google Maps</span>
              <span style={{
                marginLeft: "auto", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)",
                borderRadius: 100, padding: "3px 9px",
              }}>EN VIVO</span>
            </div>

            <div style={{
              fontSize: 84, fontWeight: 900, letterSpacing: "-4px", lineHeight: 1, color: "var(--text-1)",
              textShadow: "0 0 36px rgba(245,158,11,0.14), 0 2px 8px rgba(0,0,0,0.06)",
            }}>
              {RATING}
            </div>

            <div style={{ margin: "10px 0 10px" }}>
              <RatingStars rating={RATING} s={20} gap={4}/>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-1px", color: "var(--text-1)" }}>
                {cntTotal.toLocaleString()}
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-3)" }}>reseñas totales</span>
            </div>
          </div>

          <div className="rule"/>

          {/* Distribution */}
          <div style={{ padding: "22px 28px" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <StatChip label="Positivas" value={cntPos.toLocaleString()}
                bg="var(--green-bg)" border="var(--green-border)"
                labelColor="var(--green-mid)" valColor="var(--green)"
                subtext="4 – 5 estrellas" subtextColor="#34D399"
              />
              <StatChip label="Negativas" value={NEGATIVE}
                bg="var(--red-bg)" border="var(--red-border)"
                labelColor="var(--red-mid)" valColor="var(--red)"
                subtext="1 – 2 estrellas" subtextColor="#FCA5A5"
              />
            </div>
          </div>

          <div className="rule"/>

          {/* Pace */}
          <div style={{ padding: "22px 28px" }}>
            <div className="lbl" style={{ marginBottom: 2 }}>Ritmo necesario</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-3)", marginBottom: 14, lineHeight: 1.4 }}>
              para alcanzar el objetivo del trimestre
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 54, fontWeight: 900, letterSpacing: "-2.5px", lineHeight: 1, color: "var(--text-1)" }}>
                {PACE}
              </span>
              <div style={{ paddingBottom: 5 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", lineHeight: 1.3 }}>reseñas</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", lineHeight: 1.3 }}>por semana</div>
              </div>
            </div>

            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: PRE_Q2 ? "var(--accent-light)" : "var(--gold-bg)",
              border: PRE_Q2 ? "1px solid rgba(129,140,248,0.28)" : "1px solid var(--gold-border)",
              borderRadius: 10, padding: "9px 14px",
            }}>
              <svg width={13} height={13} viewBox="0 0 20 20" fill={PRE_Q2 ? "#6366F1" : "var(--gold)"} aria-hidden="true">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: PRE_Q2 ? "var(--accent)" : "var(--gold-mid)" }}>
                {PRE_Q2
                  ? `${DAYS_TO_START} días hasta el inicio de ${Q.label.split(" ")[0]}`
                  : `${DAYS} días restantes en ${Q.label.split(" ")[0]}`}
              </span>
            </div>
          </div>

          <div className="rule"/>

          {/* Q2 Progress */}
          <div style={{ padding: "22px 28px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="lbl">{PRE_Q2 ? `Objetivo ${Q.label}` : `Progreso ${Q.label}`}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
                {PRE_Q2 ? `0 / ${GOAL}` : `${PROGRESS} / ${GOAL}`}
              </span>
            </div>
            <ProgressBar pct={PRE_Q2 ? 0 : pct} height={9}/>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-3)", marginTop: 11, lineHeight: 1.5 }}>
              {PRE_Q2
                ? `Empieza el ${START_LABEL} · objetivo ${GOAL} reseñas positivas`
                : `${remaining} reseñas positivas para el objetivo`}
            </div>
          </div>

        </aside>

        {/* ── CENTER SCOREBOARD ────────────────────────────────────────────── */}
        <main id="main-content" style={{
          flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "28px 60px 36px", background: "var(--white)",
          overflow: "hidden", gap: 0,
        }}>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
            <div className="lbl" style={{ letterSpacing: "0.18em" }}>
              {PRE_Q2 ? `Cuenta atrás · ${Q.label}` : `Reseñas positivas · ${Q.label}`}
            </div>
            {PRE_Q2 && (
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                background: "var(--accent-light)", color: "var(--accent)", border: "1px solid rgba(129,140,248,0.28)",
                borderRadius: 100, padding: "3px 10px", flexShrink: 0,
              }}>
                No iniciado
              </div>
            )}
          </div>

          <div style={{ position: "relative", width: 360, height: 360, flexShrink: 0 }}>
            <ArcGauge value={PRE_Q2 ? 0 : PROGRESS} total={GOAL} size={360}/>

            <div aria-live="polite" aria-atomic="true" style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", paddingBottom: 48, pointerEvents: "none",
            }}>
              {PRE_Q2 ? (
                <>
                  <div style={{
                    fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
                    color: "var(--accent)", marginBottom: 4,
                  }}>
                    EMPIEZA EL {START_LABEL}
                  </div>
                  <div className="count-in" style={{
                    fontSize: 96, fontWeight: 900, letterSpacing: "-5px", lineHeight: 1,
                    color: "var(--text-1)", textShadow: "0 2px 24px rgba(0,0,0,0.07)",
                  }}>
                    {DAYS_TO_START}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-3)", letterSpacing: "-0.01em", marginTop: 6 }}>
                    días para el inicio · objetivo {GOAL}
                  </div>
                  <div style={{
                    marginTop: 10,
                    fontSize: 11, fontWeight: 600, color: "var(--accent)",
                    background: "var(--accent-pale)", borderRadius: 8, padding: "5px 12px",
                    border: "1px dashed rgba(129,140,248,0.3)",
                  }}>
                    El marcador se activará el {START_LABEL}
                  </div>
                </>
              ) : (
                <>
                  <div className="count-in" style={{
                    fontSize: 104, fontWeight: 900, letterSpacing: "-6px", lineHeight: 1,
                    color: "var(--text-1)", textShadow: "0 2px 24px rgba(0,0,0,0.07)",
                  }}>
                    {PROGRESS}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-3)", letterSpacing: "-0.01em", marginTop: 8 }}>
                    de {GOAL} objetivo
                  </div>
                </>
              )}
            </div>

          </div>

          <div style={{
            marginTop: 36, marginBottom: 18,
            fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em",
            color: PRE_Q2 ? "var(--accent)" : remaining > 0 ? "var(--text-2)" : "var(--green-mid)",
          }}>
            {PRE_Q2
              ? `¡Preparad — ${Q.label} arranca el ${START_LABEL}!`
              : remaining > 0
                ? `Faltan ${remaining} reseñas positivas para el objetivo`
                : "¡Objetivo alcanzado!"}
          </div>

          <MotivLine/>
        </main>

        {/* ── RIGHT — REVIEWS ──────────────────────────────────────────────── */}
        <aside aria-label="Reseñas de clientes en tiempo real" style={{
          width: 390, flexShrink: 0, borderLeft: "1px solid var(--divider)",
          display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)",
        }}>
          <div style={{
            height: 52, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 28px", background: "var(--white)", borderBottom: "1px solid var(--divider)",
          }}>
            <span className="lbl">Lo que dicen tus clientes</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div aria-hidden="true" className="live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E" }}/>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>En vivo</span>
            </div>
          </div>

          <div style={{
            flex: 1, padding: "24px 24px 22px",
            display: "flex", flexDirection: "column",
            justifyContent: "center", overflow: "hidden",
          }}>
            <ReviewCard review={currentReview} cls={revCls}/>

            {reviewList.length > 1 && (
              <div role="tablist" aria-label="Reseñas de clientes" style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 22 }}>
                {reviewList.map((rv, i) => (
                  <div
                    key={i}
                    role="tab"
                    tabIndex={0}
                    aria-selected={i === revIdx}
                    aria-label={`Reseña de ${rv.name}`}
                    onClick={() => { setRevCls("r-out"); setTimeout(() => { setRevIdx(i); setRevCls("r-in"); }, 350); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRevCls("r-out"); setTimeout(() => { setRevIdx(i); setRevCls("r-in"); }, 350); } }}
                    style={{
                      height: 5, borderRadius: 99,
                      width: i === revIdx ? 26 : 6,
                      background: i === revIdx ? "var(--accent)" : "var(--divider)",
                      transition: "width 0.45s cubic-bezier(0.4,0,0.2,1), background 0.45s ease",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer style={{
        height: 52, flexShrink: 0, display: "flex", alignItems: "center",
        padding: "0 52px", gap: 20, background: "var(--white)",
        borderTop: "1px solid var(--divider)",
        boxShadow: "0 -1px 0 var(--divider), 0 -2px 8px rgba(0,0,0,0.02)",
      }}>

        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: "var(--accent)", letterSpacing: "-0.5px" }}>
            {PRE_Q2 ? `↗ ${GOAL}` : PROGRESS}
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-3)" }}>
            {PRE_Q2 ? `objetivo · ${Q.label} · empieza el ${START_LABEL}` : `de ${GOAL} reseñas · ${Q.label}`}
          </span>
        </div>

        <div style={{ flex: 1 }}>
          <ProgressBar pct={PRE_Q2 ? 0 : pct} height={7}/>
        </div>

        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", flexShrink: 0 }}>
          {PRE_Q2 ? "—" : `${pct}%`}
        </span>

        <div style={{ width: 1, height: 18, background: "var(--divider)", flexShrink: 0 }}/>

        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <div aria-hidden="true" className="live" style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }}/>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)" }}>Tiempo real</span>
        </div>
      </footer>

    </div>
  );
}
