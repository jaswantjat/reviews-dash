import { logger } from "../lib/logger.js";

export interface TicketData {
  openTickets: number;
  oldestTicketDays: number;
}

export async function fetchZendeskTickets(): Promise<TicketData> {
  // Zendesk integration disabled
  return { openTickets: 0, oldestTicketDays: 0 };
}
