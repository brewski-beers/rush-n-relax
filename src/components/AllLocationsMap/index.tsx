const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

interface AllLocationsMapProps {
  title?: string;
  height?: string;
  className?: string;
}

export default function AllLocationsMap({
  title = 'All Rush N Relax Locations',
  height = '450',
  className = '',
}: AllLocationsMapProps) {
  return (
    <div className={`map-container ${className}`.trim()}>
      <iframe
        title={title}
        width="100%"
        height={height}
        style={{ border: 0, borderRadius: '0.75rem' }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://www.google.com/maps/embed/v1/search?key=${GOOGLE_MAPS_API_KEY}&q=Rush+N+Relax+Tennessee&zoom=9`}
      />
    </div>
  );
}
