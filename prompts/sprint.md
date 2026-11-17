# Sprint — board you can read and trust

17 Nov 2026. Home, Brief, and Scan were opened on `http://127.0.0.1:3000` by three interactive passes, plus a separate headless Chromium check. Reddit ingest is already removed (see the bottom). This sprint is the remaining work.

What was actually on screen: a full server-rendered board (Home at 24h, Brief at 7d, Scan at 7d). What did not happen: clicks. In both the IDE browser and headless Chromium, range buttons took focus and left the URL unchanged, React’s renderer list stayed empty, and the situation map node was absent. Scripts returned HTTP 200 and the page threw no error. The dev hot-reload socket did not complete its handshake. Treat “the board ignores clicks” as a startup failure to confirm in a normal window before calling the product down. Everything below about type size, chip wording, and layout was measured on that painted page.

## 1. Show it when the client does not start

**Why.** A finished-looking board that ignores every control is worse than a spinner. The map is loaded with server rendering off and a blank placeholder (`ssr: false`, `loading: () => null` in `components/monitor/dashboard.tsx`), so a stuck client leaves an empty gap between Rising now and the lanes. The status line still says “87 on the map.”

**Done when.** If the client has not attached within a few seconds, the page says so in the header and the map slot shows a real placeholder with a height, not a hole. A successful start still opens the Leaflet pane, and clicking **6h** changes the URL to `range=6h`. Confirm this in a normal browser, not only in automation.

**Status.** Done. The header notice is in the server HTML (`#csmon-boot`, hidden until a 4s script shows it). A started client sets `data-csmon="ready"` and keeps it hidden. The Home, stats, and reader maps use a 280px `MapSlot` while the Leaflet chunk loads.

## 2. Make the type readable

Measured on the painted Home page (IBM Plex, white cards, page background `rgb(230, 232, 238)`).

| What | Now | Target |
| --- | --- | --- |
| Topic chips | 9px, about 12px tall | At least 12px, hit target at least 24px |
| Section labels (BAD WEATHER, TOPICS, RISING NOW) | 10–11px, light gray | 12px, darker slate, still uppercase if wanted |
| Card headlines | 12px | 15–16px |
| Card summaries | 10.5px gray, two lines | 14px, darker slate, one human sentence |
| Read | 9px, about 17×35px | 12px, taller than 24px |
| Reader body | 14px / 1.7 in `article-body.tsx` (not opened; client never started) | Keep 14px. Cap the measure near 68 characters when the pane is widened |

**Done when.** A headline and its summary can be read at arm’s length without a tooltip. Chips and Read are obviously controls.

**Status.** Done. Topic chips and Read are 12px with a 24px hit target. Section labels are 12px slate. Card headlines are 15px and summaries 14px. Reader paragraphs stay 14px / 1.7 inside `max-w-[68ch]`.

## 3. Stop showing raw feed text

On Home, the Atlantic outlook summary began `000 ABNT20 KNHC 171148 TWOAT…`. A quake card repeated the headline as the body. Spain read “The flood caused 0 deaths and 0 displaced.” Bad weather (4 cards) included “ISC Stormcast…” tagged CYBER, WEATHER, and STORM, with a SANS copyright line as the summary.

**Done when.** Lane cards show a sentence a person would say. Product codes, bare URLs, and zero-casualty boilerplate stay off the summary. Stormcast and other cyber items do not sit in Bad weather. The weather lane matches storms, floods, heat, and official warnings only.

**Status.** Done. `displaySummary` supplies the card sentence. The weather rule vetoes Stormcast and the Internet Storm Center (`CLASSIFIER_VERSION` 7). The Bad weather lane also drops those stories, and other cyber items with no storm, flood, heat, or warning in the copy, before the backfill finishes.

## 4. Lead with the situation

At a ~940px width the left rail is hidden. Header, desk tabs, status line, and the chip row consume the top before the lanes. Topics, top sources, people, and rising sit above the map slot and the four lanes. Source chips clip to `CERT-FR AVIS DE SÉCU…` and `THE RECORD BY RECORD…`. The search hint clips to `Search… (try source:cisa or place:`. People listed both “THOMAS MASSIE” and “THOMAS MASSIE FORCES.”

**Done when.** The first screen is the four lanes and the map. Topics, sources, and people sit behind one disclosure. Source names wrap or use the short label, and they do not end mid-word. Duplicate person chips collapse to one name.

**Status.** Done. Home opens with the four lanes, then the map, then the lane cards. Topics, sources, people, and rising are inside one disclosure. Source labels use a short name or a word boundary. A longer person chip that starts with a shorter one collapses, and a trailing headline verb such as “Forces” is stripped at extraction.

## 5. Make filter state visible before the first click

Brief at 7d showed **377 stories · 155 layers**, chips **Ireland 3**, **UK 6**, **US 55**, **2+ sources**, **rising 18**, and **More filters**. There is no Active row until a filter exists, so a failed click looks the same as “nothing is filtered.” **155 layers** is styled like a chip and is not one. The Ireland chip’s accessible name is “Filter to Ireland 3”; the match is a title or summary mention, which is a different rule from `place:Ireland`. The search placeholder says `place:Ireland`, but the suggestion list (when the client runs) does not offer Ireland from the letters `Irel`.

The rail says “Filters live in the URL.” Unread (`csmon.unread-only`) and Sort do not. **Link** copies the URL only. Range and desk survive Clear; the rail tip does not say that. Time range is `1h 6h 24h 7d all` with no “Time range” label, and those buttons are `hidden` below the small breakpoint.

**Done when.**

- An Active row is always on screen: desk, range, and “No filters” when nothing else is set. Clear, unread, and Link sit on it.
- Pinned chips read `Place · Ireland`, with the count secondary, and the tooltip says whether the match is a mention or a `place:` token.
- The layer count is a number, not a chip.
- Typing `Irel` or `Ireland` offers `place:Ireland`. Typing `place:` lists places.
- The rail sentence matches the URL: desk, range, and filters are in the link; unread and sort stay in this browser, unless those two move into the query string. The Link tooltip lists what the link omits.
- The range control has a visible “Time range” name at every width.
- A place filter that hides ungeocoded items says so next to the count (Brief showed “329 with no place” beside 377 stories).

**Status.** Done. The Active row stays on screen with the desk, the range, and “No filters” when nothing else is set. Clear, Unread only, and Copy view sit on it. Copy view says unread and sort stay in this browser. Pinned chips read Place · Ireland with the count beside the name. The layer total is a plain number. `Irel` offers `place:Ireland`, and `place:` lists places. Time range is labeled at every width. A place filter adds “N with no place” beside the story count.

## 6. Put configuration where it is looked for

Options is not on the header. It sits inside **More**, beside KEV, Add RSS, GDELT, and ACLED. Board defaults (start desk, range, palette, home, language, stack, compact, auto-load) share that menu with retention, the classifier, logging, and `.env` instructions. Palette is only Light or Dark, while the first paint still follows the system theme when nothing is saved. **Saved**, **Query**, and **Tune** are one word each. The command palette is Ctrl+K or ⌘K and has no button. Scan’s board does not say it is the raw stream; only the rail hint “Raw items” does.

**Done when.** Options is a header button. Board settings are the first tab and show a live preview of compact cards and the palette. Data settings (retention, classifier, logs, credentials) stay on their own tab. The palette control includes “Match system,” which is the current first-paint behavior. Search has a palette button with the shortcut on it. Scan’s first screen says it is every item, unclustered.

**Status.** Done. Options is in the header. Board previews compact cards and the palette, including Match system. Data stays on its own tab. Palette sits on the search row with Ctrl K. Scan opens with “Every item, unclustered.”

## 7. Fix the small control lies

Every eye control was named “Hide weather” or “Hide cyber” and reported pressed while those topics were still shown. The header control is labeled only “Link.” Source marks such as “S NYT ES” do not say which outlet they are until hover, and hover text is not available on touch.

**Done when.** The eye says “Hide” only while the topic is visible, and “Show” when it is hidden. Link’s visible name is “Copy view.” Source marks have a full name on the chip or immediately beside it.

**Status.** Done. The eye reads Hide while the topic is visible and Show when it is hidden, and pressed matches the hidden state. The header button is Copy view. A source chip shows the layer’s full name.

## 8. Keep carried filters explained

Switching desks is supposed to keep facets and flash “Kept N filters from {desk}” for a few seconds. Custom desks replace the board instead. That toast was not seen, because the client never switched desks.

**Done when.** The note stays until dismissed. A custom desk that replaces filters says “Replaced filters with {name}.”

**Status.** Done. The kept-filters note stays until Dismiss, Clear, or Esc. A custom desk says “Replaced filters with {name}.”

## Already done — Reddit

Removed in this change, not left as a story. Header banner, More-menu loader, Sources and empty-board subreddit strips, the Reddit topic chip, the `reddit` origin toggle, Options OAuth fields, `/api/reddit`, and the OAuth fetch path are gone. Migration `011_drop_reddit` disables leftover Reddit layers and keeps stored items. `csmon.md` matches that.

## Suggested order

1, then 2 and 3 together (they touch the same cards), then 5, then 6, then 4, then 7 and 8. 1 blocks any further click-testing. 2 and 5 are the changes a reader feels on the first screen.
