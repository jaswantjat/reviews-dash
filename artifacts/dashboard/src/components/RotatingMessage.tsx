import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const MESSAGES = [
  "Experiencia excepcional, reseña memorable: esa es la cadena que mueve la marca.",
  "Cada nueva valoración alimenta el marcador en pantalla en tiempo real.",
  "El objetivo no es solo volumen: es reputación sostenida y visible.",
  "La confianza del cliente se construye servicio a servicio, reseña a reseña.",
  "Cuando el equipo aprieta el ritmo, el panel tiene que sentirse vivo.",
  "La señal correcta para el negocio no es ruido: es claridad sobre la reputación.",
];

export function RotatingMessage() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % MESSAGES.length);
    }, 8000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="ticker-shell">
      <span className="ticker-mark">On Air</span>
      <div className="relative h-6 flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="ticker-copy"
          >
            {MESSAGES[index]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
