import { CONFIG } from "../config.js";
import { logger } from "../lib/logger.js";

export interface TicketData {
  openTickets: number;
  oldestTicketDays: number;
}

export async function fetchZendeskTickets(): Promise<TicketData> {
  const { subdomain, email, token } = CONFIG.zendesk;

  if (!token) {
    logger.warn("ZENDESK_TOKEN not set, skipping ticket fetch");
    return { openTickets: 0, oldestTicketDays: 0 };
  }

  const credentials = Buffer.from(`${email}/token:${token}`).toString("base64");
  const query = encodeURIComponent("type:ticket status<solved priority:high");
  const url = `https://${subdomain}.zendesk.com/api/v2/search.json?query=${query}&sort_by=created_at&sort_order=asc`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zendesk API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    count: number;
    results: Array<{ created_at: string }>;
  };

  const openTickets = data.count ?? 0;
  let oldestTicketDays = 0;

  if (data.results && data.results.length > 0) {
    const oldest = new Date(data.results[0].created_at);
    const diffMs = Date.now() - oldest.getTime();
    oldestTicketDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  logger.info({ openTickets, oldestTicketDays }, "Zendesk tickets fetched");
  return { openTickets, oldestTicketDays };
}
