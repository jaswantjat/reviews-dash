import { logger } from "../lib/logger.js";

export interface TicketData {
  openTickets: number;
  oldestTicketDays: number;
}

interface ZendeskSearchResult {
  count: number;
  results: Array<{
    id: number;
    created_at: string;
    priority: string;
    status: string;
  }>;
}

export async function fetchZendeskTickets(): Promise<TicketData> {
  const subdomain = process.env.ZENDESK_SUBDOMAIN;
  const email = process.env.ZENDESK_EMAIL;
  const token = process.env.ZENDESK_API_TOKEN;

  if (!subdomain || !email || !token) {
    logger.warn("Zendesk env vars missing — skipping ticket fetch");
    return { openTickets: 0, oldestTicketDays: 0 };
  }

  try {
    const query = "type:ticket status:open priority:urgent";
    const url = `https://${subdomain}.zendesk.com/api/v2/search.json?query=${encodeURIComponent(query)}`;

    const credentials = Buffer.from(`${email}/token:${token}`).toString("base64");

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Zendesk API request failed");
      return { openTickets: 0, oldestTicketDays: 0 };
    }

    const data = (await res.json()) as ZendeskSearchResult;

    const openTickets = data.count ?? 0;

    let oldestTicketDays = 0;
    if (data.results && data.results.length > 0) {
      const now = Date.now();
      const oldest = data.results.reduce((acc, ticket) => {
        const created = new Date(ticket.created_at).getTime();
        return created < acc ? created : acc;
      }, now);
      oldestTicketDays = Math.floor((now - oldest) / (1000 * 60 * 60 * 24));
    }

    logger.info({ openTickets, oldestTicketDays }, "Zendesk tickets fetched");
    return { openTickets, oldestTicketDays };
  } catch (err) {
    logger.warn({ err }, "Zendesk fetch failed — returning zeros");
    return { openTickets: 0, oldestTicketDays: 0 };
  }
}
