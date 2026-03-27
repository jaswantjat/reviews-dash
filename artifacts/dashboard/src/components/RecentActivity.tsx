import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface RecentReview {
  rating: number;
  isoDate: string;
  text: string;
  author: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="text-sm leading-none" style={{ color: i < rating ? "#f59e0b" : "#e2e8f0" }}>
          ★
        </span>
      ))}
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  const isPositive = rating >= 4;
  const isNegative = rating <= 2;
  const color = isPositive ? "#10b981" : isNegative ? "#ef4444" : "#64748b";
  const bg   = isPositive ? "#f0fdf7"  : isNegative ? "#fff5f5"  : "#f1f5f9";
  const border = isPositive ? "#c6f0de" : isNegative ? "#fecaca" : "#e2e8f0";
  const label = isPositive ? "Positiva" : isNegative ? "Negativa" : "Neutral";
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      {label}
    </span>
  );
}

function ReviewCard({ review, index }: { review: RecentReview; index: number }) {
  const relDate = (() => {
    try {
      return formatDistanceToNow(parseISO(review.isoDate), { addSuffix: true, locale: es });
    } catch {
      return review.isoDate.slice(0, 10);
    }
  })();

  const isPositive = review.rating >= 4;
  const isNegative = review.rating <= 2;

  const borderLeft = isPositive ? "#10b981" : isNegative ? "#ef4444" : "#cbd5e1";
  const bgTint = isPositive ? "#f9fffe" : isNegative ? "#fff8f8" : "#fafafa";

  const initials = review.author
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();

  const avatarBg    = isPositive ? "#f0fdf7" : isNegative ? "#fff5f5" : "#f1f5f9";
  const avatarColor = isPositive ? "#10b981" : isNegative ? "#ef4444" : "#64748b";

  const cleanText = stripHtml(review.text);
  const truncated = cleanText.length > 160 ? cleanText.slice(0, 157) + "…" : cleanText;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="flex gap-3 p-4 rounded-xl flex-shrink-0"
      style={{
        background: bgTint,
        borderTop: "1px solid #eff0f8",
        borderRight: "1px solid #eff0f8",
        borderBottom: "1px solid #eff0f8",
        borderLeft: `3px solid ${borderLeft}`,
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-display font-bold text-sm"
        style={{ background: avatarBg, color: avatarColor }}
      >
        {initials || "?"}
      </div>

      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold text-sm leading-tight" style={{ color: "#0f172a" }}>{review.author}</span>
          <RatingBadge rating={review.rating} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Stars rating={review.rating} />
          <span className="text-xs" style={{ color: "#94a3b8" }}>{relDate}</span>
        </div>

        {truncated ? (
          <p className="text-sm leading-relaxed mt-0.5 italic" style={{ color: "#64748b" }}>
            "{truncated}"
          </p>
        ) : (
          <p className="text-xs italic mt-0.5" style={{ color: "#94a3b8" }}>Sin comentario escrito</p>
        )}
      </div>
    </motion.div>
  );
}

export function RecentActivity({ reviews }: { reviews: RecentReview[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const visibleCount = 3;

  useEffect(() => {
    setActiveIdx(0);
  }, [reviews]);

  useEffect(() => {
    if (reviews.length <= visibleCount) return;
    const t = setInterval(() => {
      setActiveIdx((p) => (p + 1) % (reviews.length - visibleCount + 1));
    }, 6000);
    return () => clearInterval(t);
  }, [reviews.length]);

  const visible = reviews.slice(activeIdx, activeIdx + visibleCount);

  if (reviews.length === 0) {
    return (
      <div className="surface-card rounded-2xl p-5 flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between">
          <div className="label">Reseñas Recientes</div>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: "#94a3b8", background: "#f1f5f9", border: "1px solid #e2e8f0" }}>En vivo</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <div className="text-3xl opacity-40">📭</div>
          <div className="text-sm" style={{ color: "#94a3b8" }}>Sin reseñas aún</div>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card rounded-2xl p-5 flex flex-col gap-3 h-full min-h-0">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="label">Reseñas Recientes</div>
        <div className="flex items-center gap-1.5">
          <span className="live-dot" />
          <span className="text-xs font-semibold" style={{ color: "#10b981" }}>En vivo</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 overflow-hidden flex-1">
        <AnimatePresence mode="sync">
          {visible.map((r, i) => (
            <ReviewCard key={`${r.isoDate}-${r.author}-${activeIdx}`} review={r} index={i} />
          ))}
        </AnimatePresence>
      </div>

      {reviews.length > visibleCount && (
        <div className="flex gap-1.5 flex-shrink-0 justify-center pt-1">
          {Array.from({ length: reviews.length - visibleCount + 1 }, (_, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className="rounded-full transition-all"
              style={{
                width: i === activeIdx ? 20 : 6,
                height: 6,
                background: i === activeIdx ? "#5b6cf0" : "#e2e8f0",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
