import type { Story } from "./cluster";
import { coordsForPlace, type MapMarker } from "./geo";
import { lanesForItem } from "./lanes";

function kindForStory(story: Story): MapMarker["kind"] {
  const item = story.items[0];
  if (!item) return "place";
  const lanes = lanesForItem(item);
  if (lanes.includes("weather")) return "weather";
  if (lanes.includes("quake")) return "quake";
  if (lanes.includes("war")) return "war";
  if (lanes.includes("unrest")) return "unrest";
  return "place";
}

/** One marker per story, at its first geocoded place. Nearby markers collapse by zoom. */
export function markersForStories(stories: Story[], limit = 400): MapMarker[] {
  const markers: MapMarker[] = [];
  const ordered = [...stories].sort((a, b) => b.latestAt - a.latestAt);
  for (const story of ordered) {
    const place = story.locations.find((name) => coordsForPlace(name));
    if (!place) continue;
    const point = coordsForPlace(place);
    if (!point) continue;
    markers.push({
      id: `story-${story.id}`,
      name: place,
      lat: point.lat,
      lng: point.lng,
      kind: kindForStory(story),
      count: 1,
      hint: story.title,
      storyId: story.id,
      at: story.latestAt,
    });
    if (markers.length >= limit) break;
  }
  return markers;
}
