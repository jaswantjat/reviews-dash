import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
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

function ReviewTone({ rating }: { rating: number }) {
  const tone = rating >= 4 ? "positive" : rating <= 2 ? "negative" : "neutral";
  const label =
    tone === "positive" ? "Positiva" : tone === "negative" ? "Negativa" : "Neutra";

  return (
    <span className="review-badge" data-tone={tone}>
      {label}
    </span>
  );
}

function ReviewCard({ review, index }: { review: RecentReview; index: number }) {
  const relDate = (() => {
    try {
      return formatDistanceToNow(parseISO(review.isoDate), {
        addSuffix: true,
        locale: es,
      });
    } catch {
      return review.isoDate.slice(0, 10);
    }
  })();

  const cleanText = stripHtml(review.text);
  const excerpt =
    cleanText.length > 175 ? `${cleanText.slice(0, 172).trimEnd()}…` : cleanText;
  const initials = review.author
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: "easeOut" }}
      className="review-card"
    >
      <div className="review-avatar">{initials || "?"}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white">
              {review.author}
            </div>
            <div className="review-stars">
              {Array.from({ length: 5 }, (_, itemIndex) => (
                <span key={itemIndex}>{itemIndex < review.rating ? "★" : "☆"}</span>
              ))}
            </div>
          </div>
          <ReviewTone rating={review.rating} />
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-300">
          {excerpt || "Sin comentario escrito."}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="metric-caption text-white/40">
            {review.isoDate.slice(0, 10)}
          </span>
          <span className="font-mono text-xs text-white/55">{relDate}</span>
        </div>
      </div>
    </motion.article>
  );
}

export function RecentActivity({ reviews }: { reviews: RecentReview[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const visibleCount = 4;

  useEffect(() => {
    setActiveIdx(0);
  }, [reviews]);

  useEffect(() => {
    if (reviews.length <= visibleCount) return;

    const timer = setInterval(() => {
      setActiveIdx((current) => (current + 1) % (reviews.length - visibleCount + 1));
    }, 7000);

    return () => clearInterval(timer);
  }, [reviews.length]);

  const visible = reviews.slice(activeIdx, activeIdx + visibleCount);

  return (
    <div className="tv-panel flex h-full min-h-[28rem] flex-col p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="tv-kicker">Reseñas recientes</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Señal del cliente</h3>
        </div>
        <div className="tv-pill" data-tone="live">
          <span className="signal-dot" data-tone="live" />
          Flujo activo
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="text-4xl text-white/25">⌁</div>
          <p className="max-w-sm text-sm text-slate-300">
            No hay reseñas recientes disponibles todavía para alimentar el carrusel.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-1 flex-col gap-3 overflow-hidden">
            <AnimatePresence mode="sync">
              {visible.map((review, index) => (
                <ReviewCard
                  key={`${review.isoDate}-${review.author}-${activeIdx}`}
                  review={review}
                  index={index}
                />
              ))}
            </AnimatePresence>
          </div>

          {reviews.length > visibleCount && (
            <div className="mt-4 flex justify-center gap-2">
              {Array.from(
                { length: reviews.length - visibleCount + 1 },
                (_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveIdx(index)}
                    aria-label={`Mostrar grupo ${index + 1}`}
                    className="review-carousel-dot"
                    data-active={index === activeIdx}
                  />
                ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
