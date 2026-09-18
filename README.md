# csmon

Scrape public users for sources, filter them into layers, and watch a dense situation board.

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Paste a Bluesky handle (`nytimes.com`), profile URL, RSS feed, or website. csmon harvests follows, mentions, and linked sites; you choose which become layers.

See `csmon.md` for schema and architecture.
