# Agent news and Obsidian

Set `NEWS_ENABLED=true` in Coolify's runtime environment (or the `.env` passed to Docker Compose), then redeploy the backend. News saving uses the same `OBSIDIAN_VAULT_PATH` and vault volume as the existing agent brain. AI chat still requires `AI_BASE_URL`, `AI_MODEL`, and any provider API key. To get the Android chat timeout fix, update the Android app as well as the server.

Open **AI Agent** on the web or Android and ask, for example, “Find the latest technology news and save three stories to my news feed.” The **Find and save news** button drafts a similar prompt for you to review before sending. To look up news without saving it, ask for headlines only.

The server runs Playwright's HTTP request context against fixed public RSS feeds from BBC World, BBC Technology and The Guardian World. It searches those headlines and snippets locally; it does not send search terms to publishers, open arbitrary URLs, follow redirects, read full articles, or run webpage scripts. The AI provider receives the returned public headlines as tool results, along with the usual agent context described in the app. There is no scheduled ingestion.

Saved stories appear in the Agent's **News feed** and in the managed Obsidian note `News Feed.md`, linked to `[[AI_Brain]]`. The feed keeps up to 30 distinct saved stories with publisher links. Move the note to a different filename if you want to edit or archive it; the agent does not replace a manually edited note. Existing Obsidian notes stay in the same vault and remain available to the agent.

English is the default. German remains selectable under **Settings → Appearance**. Publisher headlines are shown in their original language.
