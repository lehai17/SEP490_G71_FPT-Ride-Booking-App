const GEOAPIFY_API_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY;
const GEOAPIFY_GEOCODE_BASE_URL = "https://api.geoapify.com/v1/geocode";
const GEOAPIFY_PLACE_DETAILS_BASE_URL = "https://api.geoapify.com/v2/place-details";
const GEOAPIFY_ROUTING_BASE_URL = "https://api.geoapify.com/v1/routing";
const GEOAPIFY_STATIC_MAP_BASE_URL = "https://maps.geoapify.com/v1/staticmap";
const XANH_STYLE_AVERAGE_SPEED_KMH = 30;

const ADDRESS_COORDINATE_FALLBACKS = {
  "Đại học FPT, Thạch Hòa": {
    formattedAddress: "Đại học FPT, Khu công nghệ cao Hòa Lạc, Hà Nội",
    location: { lat: 21.0133, lng: 105.5258 },
  },
  "Đại học FPT": {
    formattedAddress: "Đại học FPT, Khu công nghệ cao Hòa Lạc, Hà Nội",
    location: { lat: 21.0133, lng: 105.5258 },
  },
  "Cổng chính Đại học FPT, Thạch Hòa, Hà Nội": {
    formattedAddress: "Cổng chính Đại học FPT, Khu công nghệ cao Hòa Lạc, Hà Nội",
    location: { lat: 21.0137, lng: 105.5262 },
  },
  "Bến xe Mỹ Đình": {
    formattedAddress: "Bến xe Mỹ Đình, Phạm Hùng, Hà Nội",
    location: { lat: 21.0287, lng: 105.7797 },
  },
};

function assertGeoapifyKey() {
  if (!GEOAPIFY_API_KEY) {
    throw new Error("Thiếu EXPO_PUBLIC_GEOAPIFY_API_KEY trong .env của FE.");
  }
}

function buildGeoapifyUrl(baseUrl, params) {
  assertGeoapifyKey();

  const searchParams = new URLSearchParams({
    ...params,
    apiKey: GEOAPIFY_API_KEY,
  });

  return `${baseUrl}?${searchParams.toString()}`;
}

function normalizeGeoapifyError(message) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("invalid api key") || lowerMessage.includes("unauthorized")) {
    return "Geoapify API key không hợp lệ.";
  }

  if (lowerMessage.includes("quota") || lowerMessage.includes("limit")) {
    return "Geoapify đã vượt giới hạn sử dụng.";
  }

  if (lowerMessage.includes("payment") || lowerMessage.includes("billing")) {
    return "Geoapify cần cấu hình thanh toán cho gói bạn đang dùng.";
  }

  return "";
}

function getResultItems(payload) {
  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.features)) {
    return payload.features;
  }

  return [];
}

function getResultFeature(payload) {
  if (Array.isArray(payload?.features) && payload.features.length > 0) {
    return payload.features[0];
  }

  return null;
}

function normalizeLocation(result) {
  const data = result?.properties ?? result ?? {};
  const geometry = result?.geometry ?? data?.geometry;
  const lat = Number(data?.lat ?? data?.latitude ?? geometry?.coordinates?.[1]);
  const lng = Number(data?.lon ?? data?.lng ?? data?.longitude ?? geometry?.coordinates?.[0]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function normalizeFormattedAddress(result) {
  const data = result?.properties ?? result ?? {};
  const parts = [
    data?.formatted,
    data?.address_line1,
    data?.address_line2,
    data?.name,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts[0];
  }

  const locationParts = [data?.street, data?.city, data?.state, data?.country].filter(Boolean);
  return locationParts.join(", ");
}

function mapGeoapifyPlace(result) {
  const data = result?.properties ?? result ?? {};
  const formattedAddress = normalizeFormattedAddress(result);
  const location = normalizeLocation(result);
  const mainText = data?.name || data?.address_line1 || formattedAddress;
  const secondaryText =
    data?.address_line2 || [data?.city, data?.state, data?.country].filter(Boolean).join(", ");

  return {
    placeId: data?.place_id || data?.placeId || data?.id || "",
    description: formattedAddress || mainText || "",
    mainText: mainText || "",
    secondaryText: secondaryText || "",
    formattedAddress: formattedAddress || mainText || "",
    location,
  };
}

function getFallbackGeocode(address) {
  return ADDRESS_COORDINATE_FALLBACKS[address.trim()] ?? null;
}

function haversineDistanceKm(origin, destination) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(destination.lat - origin.lat);
  const deltaLng = toRadians(destination.lng - origin.lng);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(destination.lat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function formatDistance(distance, units) {
  if (!Number.isFinite(distance)) {
    return "";
  }

  if (String(units).toLowerCase().includes("mile")) {
    const miles = distance / 1609.344;
    return `${miles.toFixed(miles >= 10 ? 0 : 1)} mi`;
  }

  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(distance >= 10000 ? 0 : 1)} km`;
  }

  return `${Math.round(distance)} m`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }

  const totalMinutes = Math.max(1, Math.round(seconds / 60));

  if (totalMinutes < 60) {
    return `${totalMinutes} phút`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? `${hours} giờ` : `${hours} giờ ${minutes} phút`;
}

function estimateRideDurationSeconds(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return 0;
  }

  return (distanceKm / XANH_STYLE_AVERAGE_SPEED_KMH) * 3600;
}

function getRouteDistanceKm(route) {
  const distanceMeters = Number(route?.distance);

  if (Number.isFinite(distanceMeters) && distanceMeters > 0) {
    return distanceMeters / 1000;
  }

  return 0;
}

function createApproximateRoute(origin, destination) {
  const distanceKm = haversineDistanceKm(origin.location, destination.location);
  const routeGeometry = {
    type: "Feature",
    properties: {
      linecolor: "#ff7a00",
      linewidth: 5,
      linestyle: "solid",
    },
    geometry: {
      type: "LineString",
      coordinates: [],
    },
  };

  return {
    distanceText: `${distanceKm.toFixed(1)} km`,
    durationText: formatDuration(estimateRideDurationSeconds(distanceKm)),
    routeGeometry,
    startAddress: origin.formattedAddress,
    endAddress: destination.formattedAddress,
    isFallbackRoute: true,
  };
}

function normalizeRouteGeometry(geometry) {
  if (!geometry) {
    return {
      type: "LineString",
      coordinates: [],
    };
  }

  return geometry;
}

function mapGeoapifyRoute(payload, origin, destination) {
  const feature = getResultFeature(payload);

  if (!feature) {
    return createApproximateRoute(origin, destination);
  }

  const route = feature.properties ?? {};
  const distanceKm = getRouteDistanceKm(route);
  return {
    distanceText: formatDistance(route.distance, route.distance_units),
    durationText: formatDuration(
      estimateRideDurationSeconds(distanceKm) || route.time
    ),
    routeGeometry: {
      type: "Feature",
      properties: {
        linecolor: "#ff7a00",
        linewidth: 5,
        linestyle: "solid",
      },
      geometry: normalizeRouteGeometry(feature.geometry),
    },
    startAddress: route.start_address || origin.formattedAddress,
    endAddress: route.end_address || destination.formattedAddress,
    isFallbackRoute: false,
  };
}

function createGeoapifyMarker(point, color, label) {
  return `lonlat:${point.location.lng},${point.location.lat};color:${color};size:48;text:${label}`;
}

export function isGoogleMapsConfigured() {
  return Boolean(GEOAPIFY_API_KEY);
}

export async function getGooglePlaceSuggestions(input) {
  const trimmedInput = input.trim();

  if (trimmedInput.length < 2) {
    return [];
  }

  assertGeoapifyKey();

  const response = await fetch(
    buildGeoapifyUrl(`${GEOAPIFY_GEOCODE_BASE_URL}/autocomplete`, {
      text: trimmedInput,
      lang: "vi",
      filter: "countrycode:vn",
      limit: "5",
      format: "json",
    })
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      normalizeGeoapifyError(payload?.message || payload?.error?.message || "") ||
        "Không thể tải gợi ý địa chỉ từ Geoapify."
    );
  }

  return getResultItems(payload)
    .map(mapGeoapifyPlace)
    .filter((item) => item.placeId || item.description)
    .slice(0, 5);
}

export async function getGooglePlaceDetails(placeId) {
  assertGeoapifyKey();

  const response = await fetch(
    buildGeoapifyUrl(GEOAPIFY_PLACE_DETAILS_BASE_URL, {
      id: placeId,
      lang: "vi",
      features: "details",
    })
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      normalizeGeoapifyError(payload?.message || payload?.error?.message || "") ||
        "Không thể tải chi tiết địa chỉ từ Geoapify."
    );
  }

  const result = getResultFeature(payload)?.properties ?? getResultItems(payload)[0];

  if (!result) {
    throw new Error("Không thể tải chi tiết địa chỉ từ Geoapify.");
  }

  return mapGeoapifyPlace(result);
}

export async function verifyGoogleAddress(address) {
  if (!address.trim()) {
    throw new Error("Vui lòng nhập địa chỉ cần xác minh.");
  }

  const fallback = getFallbackGeocode(address);
  const suggestions = await getGooglePlaceSuggestions(address);

  if (suggestions.length > 0 && suggestions[0].placeId) {
    return verifyGooglePlaceId(suggestions[0].placeId, suggestions[0].description);
  }

  if (fallback) {
    return {
      input: address,
      formattedAddress: fallback.formattedAddress,
      placeId: "",
      location: fallback.location,
    };
  }

  throw new Error(`Không tìm thấy địa chỉ "${address}" trên Geoapify.`);
}

export async function verifyGooglePlaceId(placeId, fallbackAddress) {
  if (!placeId) {
    return verifyGoogleAddress(fallbackAddress);
  }

  try {
    const place = await getGooglePlaceDetails(placeId);

    if (place.location) {
      return {
        input: fallbackAddress,
        formattedAddress: place.formattedAddress || fallbackAddress,
        placeId: place.placeId,
        location: place.location,
      };
    }
  } catch (error) {
    const fallback = getFallbackGeocode(fallbackAddress);

    if (fallback) {
      return {
        input: fallbackAddress,
        formattedAddress: fallback.formattedAddress,
        placeId,
        location: fallback.location,
      };
    }

    throw error;
  }

  return verifyGoogleAddress(fallbackAddress);
}

export async function getGoogleDirections(origin, destination) {
  try {
    const response = await fetch(
      buildGeoapifyUrl(GEOAPIFY_ROUTING_BASE_URL, {
        waypoints: `${origin.location.lat},${origin.location.lng}|${destination.location.lat},${destination.location.lng}`,
        mode: "drive",
        format: "geojson",
        type: "balanced",
        traffic: "approximated",
        details: "instruction_details,route_details",
      })
    );
    const payload = await response.json();

    if (!response.ok) {
      return createApproximateRoute(origin, destination);
    }

    return mapGeoapifyRoute(payload, origin, destination);
  } catch {
    return createApproximateRoute(origin, destination);
  }
}

export async function reverseGooglePlaceLocation(location) {
  assertGeoapifyKey();

  const response = await fetch(
    buildGeoapifyUrl(`${GEOAPIFY_GEOCODE_BASE_URL}/reverse`, {
      lat: String(location.lat),
      lon: String(location.lng),
      lang: "vi",
      format: "json",
      limit: "1",
    })
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      normalizeGeoapifyError(payload?.message || payload?.error?.message || "") ||
        "Không thể xác định địa chỉ từ Geoapify."
    );
  }

  const place = mapGeoapifyPlace(getResultItems(payload)[0] ?? payload);

  return {
    ...place,
    location: place.location ?? { lat: location.lat, lng: location.lng },
  };
}

export function getGoogleStaticMapUrl({
  origin,
  destination,
  routeGeometry,
  width = 640,
  height = 360,
}) {
  assertGeoapifyKey();

  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    format: "png",
    scaleFactor: "2",
    style: "osm-bright",
    lang: "vi",
    apiKey: GEOAPIFY_API_KEY,
  });

  params.set(
    "marker",
    [
      createGeoapifyMarker(origin, "#ff7a00", "D"),
      createGeoapifyMarker(destination, "#dc2626", "K"),
    ].join("|")
  );

  if (routeGeometry) {
    params.set("geojson", JSON.stringify(routeGeometry));
  }

  return `${GEOAPIFY_STATIC_MAP_BASE_URL}?${params.toString()}`;
}

export function getGooglePlaceMapUrl({ point, width = 640, height = 720, zoom = 16 }) {
  assertGeoapifyKey();

  const params = new URLSearchParams({
    center: `lonlat:${point.location.lng},${point.location.lat}`,
    zoom: String(zoom),
    width: String(width),
    height: String(height),
    format: "png",
    scaleFactor: "2",
    style: "osm-bright",
    lang: "vi",
    apiKey: GEOAPIFY_API_KEY,
  });

  params.set("marker", createGeoapifyMarker(point, "#ff7a00", "D"));

  return `${GEOAPIFY_STATIC_MAP_BASE_URL}?${params.toString()}`;
}

export function buildGeoapifyInteractiveMapHtml({
  center,
  markers = [],
  routeGeometry = null,
  zoom = 16,
  routeColor = "#ff7a00",
  draggableMarkerIndex = -1,
  fitPadding = null,
}) {
  assertGeoapifyKey();

  const safeCenter = center ?? markers[0] ?? { lat: 21.0137, lng: 105.5262 };
  const safeMarkers = markers.filter(Boolean);
  const safeRouteGeometry = routeGeometry ?? null;
  const apiKey = GEOAPIFY_API_KEY;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { margin: 0; width: 100%; height: 100%; background: #eef4f7; }
      .leaflet-control-attribution { font-size: 10px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const center = ${JSON.stringify(safeCenter)};
      const markers = ${JSON.stringify(safeMarkers)};
      const routeGeometry = ${JSON.stringify(safeRouteGeometry)};
      const fitPadding = ${JSON.stringify(fitPadding)};
      const draggableMarkerIndex = ${Number.isInteger(draggableMarkerIndex) ? draggableMarkerIndex : -1};
      const map = L.map("map", {
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
      }).setView([center.lat, center.lng], ${zoom});

      L.tileLayer("https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${apiKey}", {
        maxZoom: 20,
        attribution: '© OpenStreetMap © Geoapify',
      }).addTo(map);

      const bounds = [];

      markers.forEach((marker) => {
        if (marker && Number.isFinite(marker.lat) && Number.isFinite(marker.lng)) {
          const markerIndex = markers.indexOf(marker);
          const isDraggable = markerIndex === draggableMarkerIndex;
          const leafletMarker = L.marker([marker.lat, marker.lng], { draggable: isDraggable }).addTo(map);
          if (marker.popupText) {
            leafletMarker.bindPopup(marker.popupText);
          }
          if (isDraggable) {
            leafletMarker.on("dragend", async (event) => {
              const nextPoint = event.target.getLatLng();
              let formattedAddress = "";

              try {
                const reverseResponse = await fetch(
                  "https://api.geoapify.com/v1/geocode/reverse?lat=" +
                    nextPoint.lat +
                    "&lon=" +
                    nextPoint.lng +
                    "&lang=vi&format=json&limit=1&apiKey=${apiKey}"
                );
                const reversePayload = await reverseResponse.json();
                const reverseResult = reversePayload?.results?.[0] ?? reversePayload?.features?.[0] ?? null;
                formattedAddress =
                  reverseResult?.formatted ||
                  reverseResult?.properties?.formatted ||
                  reverseResult?.properties?.address_line1 ||
                  "";
              } catch {}

              if (window.ReactNativeWebView?.postMessage) {
                window.ReactNativeWebView.postMessage(
                  JSON.stringify({
                    type: "pickup_marker_drag_end",
                    location: { lat: nextPoint.lat, lng: nextPoint.lng },
                    formattedAddress,
                  })
                );
              }
            });
          }
          bounds.push([marker.lat, marker.lng]);
        }
      });

      function toLeafletRoutePoints(geometry) {
        if (!geometry || !Array.isArray(geometry.coordinates)) {
          return [];
        }

        const lineCoordinates =
          geometry.type === "MultiLineString"
            ? geometry.coordinates.flat()
            : geometry.coordinates;

        return lineCoordinates
          .map((coordinate) => {
            const lng = Number(coordinate?.[0]);
            const lat = Number(coordinate?.[1]);
            return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
          })
          .filter(Boolean);
      }

      const routePoints = toLeafletRoutePoints(routeGeometry?.geometry);

      if (routePoints.length > 1) {
        const routeOutline = L.polyline(routePoints, {
          color: "#ffffff",
          weight: 10,
          opacity: 0.95,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(map);

        const routeLine = L.polyline(routePoints, {
          color: "${routeColor}",
          weight: 6,
          opacity: 1,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(map);

        const routeBounds = routeLine.getBounds();
        if (routeBounds.isValid()) {
          bounds.push(routeBounds.getSouthWest());
          bounds.push(routeBounds.getNorthEast());
        }
      }

      function fitMapToContent() {
        if (bounds.length === 0) {
          return;
        }

        map.invalidateSize();

        if (fitPadding?.paddingTopLeft && fitPadding?.paddingBottomRight) {
          map.fitBounds(bounds, {
            paddingTopLeft: fitPadding.paddingTopLeft,
            paddingBottomRight: fitPadding.paddingBottomRight,
            maxZoom: fitPadding.maxZoom,
          });
          return;
        }

        map.fitBounds(bounds, {
          padding: fitPadding?.padding ?? [32, 32],
          maxZoom: fitPadding?.maxZoom,
        });
      }

      fitMapToContent();
      setTimeout(fitMapToContent, 150);
      setTimeout(fitMapToContent, 450);
    </script>
  </body>
</html>`;
}
