import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MESSAGES = [
  "¡Vamos Eltex! Cada reseña nos acerca más a la meta.",
  "Sigue empujando — 270 está al alcance.",
  "Las 5 estrellas empiezan con una experiencia excepcional.",
  "Cada reseña cuenta. Cada cliente importa.",
  "El equipo es increíble — ¡a seguir así!",
  "Pide esa reseña. Te la has ganado.",
  "La excelencia en el servicio se refleja en cada valoración.",
  "¡Un cliente satisfecho es la mejor publicidad!",
];

export function RotatingMessage() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((p) => (p + 1) % MESSAGES.length), 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-3 min-w-0 flex-1 mr-6">
      <span className="text-blue-500 text-base flex-shrink-0">✦</span>
      <div className="relative h-6 flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 font-display font-semibold text-slate-500 text-sm leading-6 whitespace-nowrap"
          >
            {MESSAGES[index]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
