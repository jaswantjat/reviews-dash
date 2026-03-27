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

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="text-base leading-none" style={{ color: i < rating ? "#fbbf24" : "rgba(255,255,255,0.1)" }}>
          ★
        </span>
      ))}
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  const isPositive = rating >= 4;
  const isNegative = rating <= 2;
  const color = isPositive ? "#34d399" : isNegative ? "#f87171" : "rgba(255,255,255,0.5)";
  const bg = isPositive ? "rgba(16,185,129,0.12)" : isNegative ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.06)";
  const label = isPositive ? "Positiva" : isNegative ? "Negativa" : "Neutral";
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: bg, color }}
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

  const borderLeft = isPositive ? "#34d399" : isNegative ? "#f87171" : "rgba(255,255,255,0.2)";
  const bgTint = isPositive ? "rgba(16,185,129,0.04)" : isNegative ? "rgba(248,113,113,0.04)" : "transparent";

  const initials = review.author
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();

  const avatarBg = isPositive ? "rgba(16,185,129,0.15)" : isNegative ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.08)";
  const avatarColor = isPositive ? "#34d399" : isNegative ? "#f87171" : "rgba(255,255,255,0.5)";

  const truncated = review.text.length > 160 ? review.text.slice(0, 157) + "…" : review.text;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="flex gap-3 p-4 rounded-xl flex-shrink-0"
      style={{ background: bgTint, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.06)", borderLeftWidth: 3, borderLeftColor: borderLeft }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-display font-bold text-sm"
        style={{ background: avatarBg, color: avatarColor }}
      >
        {initials || "?"}
      </div>

      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold text-white text-sm leading-tight">{review.author}</span>
          <RatingBadge rating={review.rating} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Stars rating={review.rating} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{relDate}</span>
        </div>

        {truncated ? (
          <p className="text-sm leading-relaxed mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
            "{truncated}"
          </p>
        ) : (
          <p className="text-xs italic mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Sin comentario escrito</p>
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
      <div className="glass-card rounded-2xl p-5 flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between">
          <div className="label">Reseñas Recientes</div>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>En vivo</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <div className="text-3xl opacity-30">📭</div>
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Sin reseñas aún</div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3 h-full min-h-0">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="label">Reseñas Recientes</div>
        <div className="flex items-center gap-1.5">
          <span className="live-dot" />
          <span className="text-xs font-medium" style={{ color: "#34d399" }}>En vivo</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 overflow-hidden flex-1">
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
                background: i === activeIdx ? "#5b6cf0" : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
