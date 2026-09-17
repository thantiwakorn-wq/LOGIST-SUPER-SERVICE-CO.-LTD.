import React, { useEffect, useRef } from 'react';
import { SHOP_LOCATION, INITIAL_LANDMARKS } from '../data/mockData';
import { calculateDistanceKm, calculateDeliveryFee } from '../utils/helpers';
import { MapPin, Navigation, Compass, ExternalLink } from 'lucide-react';
import L from 'leaflet';

interface DeliveryMapProps {
  selectedLat: number;
  selectedLng: number;
  selectedName: string;
  onLocationSelect: (lat: number, lng: number, name: string, distanceKm: number, fee: number) => void;
  interactive?: boolean;
}

export const DeliveryMap: React.FC<DeliveryMapProps> = ({
  selectedLat,
  selectedLng,
  selectedName,
  onLocationSelect,
  interactive = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const currentDistance = calculateDistanceKm(
    SHOP_LOCATION.lat,
    SHOP_LOCATION.lng,
    selectedLat,
    selectedLng
  );
  const currentFee = calculateDeliveryFee(currentDistance);

  // Initialize or update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [selectedLat || SHOP_LOCATION.lat, selectedLng || SHOP_LOCATION.lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Custom Shop Marker
      const shopIcon = L.divIcon({
        className: 'custom-shop-pin',
        html: `
          <div style="background-color: #ea580c; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); border: 2px solid white; font-size: 16px;">
            🥤
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      L.marker([SHOP_LOCATION.lat, SHOP_LOCATION.lng], { icon: shopIcon })
        .addTo(map)
        .bindPopup(`<b>${SHOP_LOCATION.name}</b><br/>จุดเริ่มต้นจัดส่ง (หน้า ม.อุบล แถวร้านบิวตี้)`);

      // Delivery Destination Marker
      const destIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: `
          <div style="background-color: #0284c7; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); border: 2px solid white; font-size: 14px;">
            📍
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const destMarker = L.marker([selectedLat, selectedLng], {
        icon: destIcon,
        draggable: interactive,
      }).addTo(map);

      userMarkerRef.current = destMarker;

      if (interactive) {
        // Handle map click
        map.on('click', (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          destMarker.setLatLng([lat, lng]);
          const dist = calculateDistanceKm(SHOP_LOCATION.lat, SHOP_LOCATION.lng, lat, lng);
          const fee = calculateDeliveryFee(dist);
          onLocationSelect(lat, lng, 'พิกัดปักหมุดบนแผนที่', dist, fee);
        });

        // Handle marker drag
        destMarker.on('dragend', () => {
          const pos = destMarker.getLatLng();
          const dist = calculateDistanceKm(SHOP_LOCATION.lat, SHOP_LOCATION.lng, pos.lat, pos.lng);
          const fee = calculateDeliveryFee(dist);
          onLocationSelect(pos.lat, pos.lng, 'พิกัดที่ลากปักหมุด', dist, fee);
        });
      }

      mapInstanceRef.current = map;
    } else {
      // Update existing marker
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([selectedLat, selectedLng]);
        mapInstanceRef.current.panTo([selectedLat, selectedLng], { animate: true });
      }
    }

    return () => {
      // Cleanup on unmount if needed
    };
  }, [selectedLat, selectedLng, interactive, onLocationSelect]);

  // Handle preset click
  const handleSelectPreset = (landmark: (typeof INITIAL_LANDMARKS)[0]) => {
    const dist = calculateDistanceKm(
      SHOP_LOCATION.lat,
      SHOP_LOCATION.lng,
      landmark.lat,
      landmark.lng
    );
    const fee = calculateDeliveryFee(dist);
    onLocationSelect(landmark.lat, landmark.lng, landmark.name, dist, fee);
  };

  const googleMapsNavUrl = `https://www.google.com/maps/dir/?api=1&origin=${SHOP_LOCATION.lat},${SHOP_LOCATION.lng}&destination=${selectedLat},${selectedLng}&travelmode=driving`;

  return (
    <div className="flex flex-col gap-3">
      {/* Popular UBU Landmarks Quick Pick */}
      <div>
        <label className="text-xs font-semibold text-stone-700 block mb-1.5 flex items-center justify-between">
          <span>เลือกจุดส่งยอดนิยมแถว ม.อุบล - วาริน</span>
          <span className="text-[11px] font-normal text-stone-500">แตะเพื่อปักหมุดทันที</span>
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none text-xs">
          {INITIAL_LANDMARKS.slice(0, 5).map((l) => {
            const isSelected = selectedName === l.name;
            return (
              <button
                key={l.name}
                type="button"
                onClick={() => handleSelectPreset(l)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full border transition-all text-xs flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span>{l.name.split(' (')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-56 sm:h-64 rounded-2xl overflow-hidden border border-stone-200 shadow-inner bg-stone-100">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Map Legend Overlay */}
        <div className="absolute top-2.5 left-2.5 z-10 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-xl text-[11px] shadow-sm border border-stone-200 flex items-center gap-2">
          <span className="flex items-center gap-1 text-orange-700 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block"></span> ร้านน้ำปั่น (หน้า ม. แถวบิวตี้)
          </span>
          <span className="text-stone-300">|</span>
          <span className="flex items-center gap-1 text-sky-700 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block"></span> จุดส่งลูกค้า
          </span>
        </div>

        {/* Distance & Fee Badge */}
        <div className="absolute bottom-2.5 right-2.5 z-10 bg-stone-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl text-xs shadow-md flex items-center gap-2">
          <div className="flex items-center gap-1 text-amber-300 font-medium">
            <Navigation className="w-3.5 h-3.5" />
            <span>{currentDistance} กม.</span>
          </div>
          <span className="text-stone-600">|</span>
          <span className="font-semibold text-emerald-300">
            {currentFee === 0 ? 'ส่งฟรี' : `ค่าส่ง ฿${currentFee}`}
          </span>
        </div>

        {/* Map Interactive Hint */}
        {interactive && (
          <div className="absolute top-2.5 right-2.5 z-10 bg-white/90 text-stone-600 px-2 py-1 rounded-lg text-[10px] shadow-sm border border-stone-200 flex items-center gap-1">
            <Compass className="w-3 h-3 text-stone-500" />
            <span>แตะหรือลากหมุดบนแผนที่ได้</span>
          </div>
        )}
      </div>

      {/* External Google Maps Button */}
      <div className="flex items-center justify-between bg-stone-100 p-2.5 rounded-xl border border-stone-200 text-xs">
        <div className="truncate pr-2">
          <span className="text-stone-500 block text-[10px]">พิกัดจัดส่ง</span>
          <span className="font-medium text-stone-800 truncate block">{selectedName}</span>
        </div>
        <a
          href={googleMapsNavUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-white hover:bg-stone-50 text-stone-800 px-3 py-1.5 rounded-lg border border-stone-300 shadow-xs font-medium text-xs whitespace-nowrap transition-colors"
        >
          <span>เปิด Google Maps</span>
          <ExternalLink className="w-3 h-3 text-stone-500" />
        </a>
      </div>
    </div>
  );
};
