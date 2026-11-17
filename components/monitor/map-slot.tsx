export function MapSlot({
  title = "Where coverage relates",
  hint = "The map opens when the board starts. If this box stays, reload the page.",
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className="map-slot card-tile" role="status">
      <p className="map-slot-title">{title}</p>
      <p className="map-slot-hint">{hint}</p>
    </div>
  );
}
