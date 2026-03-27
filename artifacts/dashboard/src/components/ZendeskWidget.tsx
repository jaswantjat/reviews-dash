import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";

interface ZendeskWidgetProps {
  openTickets: number;
  oldestTicketDays: number;
}

export function ZendeskWidget({
  openTickets,
  oldestTicketDays,
}: ZendeskWidgetProps) {
  const isClear = openTickets === 0;
  const isCritical = !isClear && oldestTicketDays > 7;
  const isWarning = !isClear && oldestTicketDays > 3 && !isCritical;
  const tone = isClear ? "live" : isCritical ? "danger" : isWarning ? "warning" : "neutral";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="tv-panel p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="tv-kicker">Zendesk</div>
          <h3 className="mt-2 text-xl font-semibold text-white">Presión operativa</h3>
        </div>
        <div className="tv-pill" data-tone={tone === "danger" ? "warning" : tone}>
          <span
            className="signal-dot"
            data-tone={tone === "danger" ? "warning" : tone}
          />
          {isClear
            ? "Todo limpio"
            : isCritical
              ? "Atención inmediata"
              : isWarning
                ? "Vigilar cola"
                : "En seguimiento"}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <div className="status-tile">
          <div className="status-icon">
            {isClear ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-300" />
            ) : (
              <AlertTriangle
                className={`h-6 w-6 ${
                  isCritical ? "text-rose-300" : "text-amber-300"
                }`}
              />
            )}
          </div>
          <div>
            <span className="metric-caption text-white/45">Tickets abiertos</span>
            <div className="metric-value mt-2 text-white">
              {isClear ? "0" : openTickets.toLocaleString("es-ES")}
            </div>
          </div>
        </div>

        <div className="status-tile">
          <div className="status-icon">
            <Clock3 className="h-6 w-6 text-sky-300" />
          </div>
          <div>
            <span className="metric-caption text-white/45">Más antiguo</span>
            <div className="metric-value mt-2 text-white">
              {openTickets === 0 ? "0d" : `${oldestTicketDays}d`}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
