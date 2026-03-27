import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface ZendeskWidgetProps {
  openTickets: number;
  oldestTicketDays: number;
}

export function ZendeskWidget({ openTickets, oldestTicketDays }: ZendeskWidgetProps) {
  const isClear = openTickets === 0;
  const isCritical = !isClear && oldestTicketDays > 7;
  const isWarning = !isClear && oldestTicketDays > 3 && !isCritical;

  const borderColor = isClear
    ? "border-green-500/20"
    : isCritical
    ? "border-red-500/40"
    : isWarning
    ? "border-amber-500/30"
    : "border-white/10";

  const bgColor = isClear
    ? "bg-green-500/5"
    : isCritical
    ? "bg-red-500/10"
    : isWarning
    ? "bg-amber-500/8"
    : "bg-white/5";

  const countColor = isClear ? "text-green-400" : isCritical ? "text-red-400" : "text-amber-400";
  const ageColor = isCritical ? "text-red-400" : isWarning ? "text-amber-400" : "text-white/60";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-4 px-5 py-3 rounded-xl border ${borderColor} ${bgColor} backdrop-blur-md`}
    >
      <div className={`flex-shrink-0 ${countColor}`}>
        {isClear ? (
          <CheckCircle className="w-7 h-7" />
        ) : isCritical ? (
          <AlertTriangle className="w-7 h-7 animate-pulse" />
        ) : (
          <AlertTriangle className="w-7 h-7" />
        )}
      </div>

      <div className="flex flex-col leading-tight">
        <div className="label mb-0.5">Priority Tickets</div>
        {isClear ? (
          <span className="font-display font-bold text-green-400 text-xl">All Clear</span>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className={`font-display font-bold text-2xl ${countColor}`}>{openTickets}</span>
            <span className="text-white/40 text-sm font-medium">open</span>
          </div>
        )}
      </div>

      {!isClear && (
        <>
          <div className="w-px h-8 bg-white/10 mx-1" />
          <div className="flex flex-col items-center leading-tight">
            <Clock className={`w-4 h-4 mb-0.5 ${ageColor}`} />
            <span className={`font-display font-bold text-xl ${ageColor}`}>{oldestTicketDays}d</span>
            <div className="label" style={{ fontSize: "0.6rem" }}>oldest</div>
          </div>
        </>
      )}
    </motion.div>
  );
}
