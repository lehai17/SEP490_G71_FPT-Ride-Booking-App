const VIETMAP_API_KEY = process.env.EXPO_PUBLIC_VIETMAP_API_KEY;
const VIETMAP_BASE_URL = "https://maps.vietmap.vn/api";
const XANH_STYLE_AVERAGE_SPEED_KMH = 30;

function assertVietMapKey() {
  if (!VIETMAP_API_KEY) {
    throw new Error("Thieu EXPO_PUBLIC_VIETMAP_API_KEY trong .env cua FE.");
  }
}

function buildVietMapUrl(path, params = {}) {
  assertVietMapKey();

  const searchParams = new URLSearchParams({
    apikey: VIETMAP_API_KEY,
    ...params,
  });

  return `${VIETMAP_BASE_URL}${path}?${searchParams.toString()}`;
}

function getPayloadItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload?.data_old) {
    return [payload.data_old];
  }

  if (payload?.data_new) {
    return [payload.data_new];
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (payload?.data && typeof payload.data === "object") {
    return [payload.data];
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.features)) {
    return payload.features;
  }

  return [];
}

function normalizeVietMapError(message) {
  const lowerMessage = String(message || "").toLowerCase();

  if (lowerMessage.includes("key") || lowerMessage.includes("unauthorized")) {
    return "VietMap API key khong hop le hoac chua duoc kich hoat.";
  }

  if (lowerMessage.includes("limit") || lowerMessage.includes("quota")) {
    return "VietMap da vuot gioi han request hien tai.";
  }

  return "";
}

function normalizeLocation(item) {
  const data = item?.properties ?? item ?? {};
  const geometry = item?.geometry ?? data?.geometry;
  const rawCoordinates = geometry?.coordinates;
  const lat = Number(
    data?.lat ??
      data?.latitude ??
      data?.y ??
      rawCoordinates?.[1]
  );
  const lng = Number(
    data?.lng ??
      data?.lon ??
      data?.longitude ??
      data?.x ??
      rawCoordinates?.[0]
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function normalizeFormattedAddress(item) {
  const data = item?.properties ?? item ?? {};
  const nestedData =
    data?.data_old ||
    data?.data_new ||
    data?.address_components ||
    null;

  if (nestedData && !Array.isArray(nestedData)) {
    const nestedFormatted = normalizeFormattedAddress(nestedData);

    if (nestedFormatted) {
      return nestedFormatted;
    }
  }

  const formatted =
    data?.display ||
    data?.displayName ||
    data?.display_name ||
    data?.full_address ||
    data?.fullAddress ||
    data?.formatted_address ||
    data?.formatted ||
    data?.label ||
    data?.address ||
    data?.name;

  if (formatted) {
    return String(formatted);
  }

  return [
    data?.housenumber,
    data?.street,
    data?.ward,
    data?.district,
    data?.city,
    data?.province,
  ]
    .filter(Boolean)
    .join(", ");
}

function mapVietMapPlace(item, index = 0) {
  const data = item?.properties ?? item ?? {};
  const oldData = data?.data_old ?? {};
  const newData = data?.data_new ?? {};
  const formattedAddress = normalizeFormattedAddress(item);
  const location = normalizeLocation(item);
  const mainText =
    data?.name ||
    oldData?.name ||
    newData?.name ||
    data?.display ||
    oldData?.display ||
    newData?.display ||
    data?.address ||
    oldData?.address ||
    newData?.address ||
    formattedAddress ||
    "";
  const secondaryText =
    data?.address ||
    oldData?.address ||
    newData?.address ||
    [data?.ward, data?.district, data?.city, data?.province].filter(Boolean).join(", ");
  const refId =
    data?.ref_id ||
    oldData?.ref_id ||
    newData?.ref_id ||
    data?.refId ||
    data?.refid ||
    data?.place_id ||
    data?.id ||
    "";
  const generatedId = `${location?.lat ?? ""},${location?.lng ?? ""}:${formattedAddress}:${index}`;

  return {
    placeId: refId || generatedId,
    refId,
    description: formattedAddress || mainText,
    mainText,
    secondaryText,
    formattedAddress: formattedAddress || mainText,
    location,
  };
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

function formatDistance(distanceMeters) {
  const meters = Number(distanceMeters);

  if (!Number.isFinite(meters) || meters <= 0) {
    return "";
  }

  if (meters >= 1000) {
    const km = meters / 1000;
    return `${(km >= 10 ? Math.round(km) : Math.round(km * 10) / 10).toLocaleString("vi-VN")} km`;
  }

  return `${Math.round(meters)} m`;
}

function formatDuration(seconds) {
  const durationSeconds = Number(seconds);

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return "";
  }

  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60));

  if (totalMinutes < 60) {
    return `${totalMinutes} ph\u00fat`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? `${hours} gi\u1edd` : `${hours} gi\u1edd ${minutes} ph\u00fat`;
}

function estimateRideDurationSeconds(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return 0;
  }

  return (distanceKm / XANH_STYLE_AVERAGE_SPEED_KMH) * 3600;
}

function getCurrentUtcIsoString() {
  return new Date().toISOString();
}

function summarizeCongestion(route) {
  const annotations = route?.annotations ?? {};
  const congestionSegments = Array.isArray(annotations?.congestion)
    ? annotations.congestion
    : [];
  const heavyDistanceSegments = Array.isArray(annotations?.congestion_distance)
    ? annotations.congestion_distance
    : [];
  const segmentCounts = congestionSegments.reduce((accumulator, level) => {
    const key = String(level || "unknown").toLowerCase();
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
  const heavyDistanceMeters = heavyDistanceSegments.reduce((total, value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? total + numericValue : total;
  }, 0);

  return {
    segmentCounts,
    heavyDistanceMeters,
    heavyDistanceText: formatDistance(heavyDistanceMeters),
  };
}

function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== "string") {
    return [];
  }

  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let byte;
    let shift = 0;
    let result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lng / 1e5, lat / 1e5]);
  }

  return coordinates;
}

function normalizeRouteCoordinates(route) {
  const points = route?.points ?? route?.geometry;
  const coordinates = points?.coordinates ?? route?.coordinates;

  if (Array.isArray(coordinates)) {
    return coordinates;
  }

  if (typeof points === "string") {
    return decodePolyline(points);
  }

  return [];
}

function createApproximateRoute(origin, destination) {
  const distanceKm = haversineDistanceKm(origin.location, destination.location);
  const distanceMeters = distanceKm * 1000;

  return {
    distanceMeters,
    durationSeconds: estimateRideDurationSeconds(distanceKm),
    distanceText: formatDistance(distanceMeters),
    durationText: formatDuration(estimateRideDurationSeconds(distanceKm)),
    routeGeometry: {
      type: "Feature",
      properties: {
        linecolor: "#ff7a00",
        linewidth: 5,
        linestyle: "solid",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [origin.location.lng, origin.location.lat],
          [destination.location.lng, destination.location.lat],
        ],
      },
    },
    startAddress: origin.formattedAddress,
    endAddress: destination.formattedAddress,
    isFallbackRoute: true,
  };
}

function mapVietMapRoute(payload, origin, destination) {
  const route = payload?.paths?.[0] ?? payload?.routes?.[0] ?? payload?.data?.paths?.[0];

  if (!route) {
    return createApproximateRoute(origin, destination);
  }

  const distanceMeters = Number(route.distance ?? route.summary?.lengthInMeters);
  const rawTime = Number(route.time ?? route.duration ?? route.summary?.travelTimeInSeconds);
  const durationSeconds = rawTime > 10000 ? rawTime / 1000 : rawTime;
  const effectiveDurationSeconds =
    durationSeconds || estimateRideDurationSeconds(distanceMeters / 1000);
  const coordinates = normalizeRouteCoordinates(route);
  const congestionSummary = summarizeCongestion(route);

  return {
    distanceMeters,
    durationSeconds: effectiveDurationSeconds,
    distanceText: formatDistance(distanceMeters),
    durationText: formatDuration(effectiveDurationSeconds),
    congestionSummary,
    source: "vietmap-route-v3",
    routeGeometry: {
      type: "Feature",
      properties: {
        linecolor: "#ff7a00",
        linewidth: 5,
        linestyle: "solid",
      },
      geometry: {
        type: "LineString",
        coordinates,
      },
    },
    startAddress: origin.formattedAddress,
    endAddress: destination.formattedAddress,
    isFallbackRoute: coordinates.length < 2,
  };
}

export function isVietMapConfigured() {
  return Boolean(VIETMAP_API_KEY);
}

export async function getVietMapPlaceSuggestions(input) {
  const trimmedInput = input.trim();

  if (trimmedInput.length < 2) {
    return [];
  }

  const response = await fetch(
    buildVietMapUrl("/autocomplete/v3", {
      text: trimmedInput,
      size: "6",
      focus: "21.028511,105.804817",
    })
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      normalizeVietMapError(payload?.message || payload?.error) ||
        "Khong the tai goi y dia chi tu VietMap."
    );
  }

  return getPayloadItems(payload)
    .map(mapVietMapPlace)
    .filter((item) => item.refId || item.location || item.description)
    .slice(0, 6);
}

export async function getVietMapPlaceDetails(placeId) {
  assertVietMapKey();

  const response = await fetch(
    buildVietMapUrl("/place/v3", {
      refid: placeId,
    })
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      normalizeVietMapError(payload?.message || payload?.error) ||
        "Khong the tai chi tiet dia chi tu VietMap."
    );
  }

  const result = Array.isArray(payload) ? payload[0] : payload?.data ?? payload;
  const place = mapVietMapPlace(result);

  if (!place.location) {
    throw new Error("Khong the tai toa do dia chi tu VietMap.");
  }

  return place;
}

export async function verifyVietMapAddress(address) {
  if (!address.trim()) {
    throw new Error("Vui long nhap dia chi can xac minh.");
  }

  const suggestions = await getVietMapPlaceSuggestions(address);
  const firstSuggestion = suggestions[0];

  if (!firstSuggestion) {
    throw new Error(`Khong tim thay dia chi "${address}" tren VietMap.`);
  }

  if (firstSuggestion.location) {
    return firstSuggestion;
  }

  return getVietMapPlaceDetails(firstSuggestion.refId || firstSuggestion.placeId);
}

export async function reverseVietMapPlaceLocation(location) {
  const tryReverseRequest = async (path, params) => {
    const response = await fetch(buildVietMapUrl(path, params));
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        normalizeVietMapError(payload?.message || payload?.error) ||
          "Khong the xac dinh dia chi tu VietMap."
      );
    }

    return payload;
  };

  let payload;

  try {
    payload = await tryReverseRequest("/reverse/v4", {
      lat: String(location.lat),
      lng: String(location.lng),
      display_type: "6",
    });
  } catch {
    payload = await tryReverseRequest("/reverse/v3", {
      lat: String(location.lat),
      lng: String(location.lng),
    });
  }

  const result = getPayloadItems(payload)[0] ?? payload;
  const place = mapVietMapPlace(result);

  return {
    ...place,
    formattedAddress: place.formattedAddress || place.description || place.mainText,
    description: place.description || place.formattedAddress || place.mainText,
    mainText: place.mainText || place.formattedAddress || place.description,
    location: place.location ?? location,
  };
}

export async function getVietMapDirections(origin, destination) {
  try {
    const params = new URLSearchParams({
      apikey: VIETMAP_API_KEY,
      vehicle: "car",
      points_encoded: "false",
      locale: "vi",
      time: getCurrentUtcIsoString(),
      annotations: "congestion,congestion_distance",
    });
    params.append("point", `${origin.location.lat},${origin.location.lng}`);
    params.append("point", `${destination.location.lat},${destination.location.lng}`);

    const response = await fetch(`${VIETMAP_BASE_URL}/route/v3?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok) {
      const fallbackParams = new URLSearchParams({
        "api-version": "1.1",
        apikey: VIETMAP_API_KEY,
        vehicle: "car",
        locale: "vi",
        points_encoded: "false",
      });
      fallbackParams.append("point", `${origin.location.lat},${origin.location.lng}`);
      fallbackParams.append("point", `${destination.location.lat},${destination.location.lng}`);

      const fallbackResponse = await fetch(
        `${VIETMAP_BASE_URL}/route?${fallbackParams.toString()}`
      );
      const fallbackPayload = await fallbackResponse.json();

      if (!fallbackResponse.ok) {
        return createApproximateRoute(origin, destination);
      }

      return mapVietMapRoute(fallbackPayload, origin, destination);
    }

    return mapVietMapRoute(payload, origin, destination);
  } catch {
    return createApproximateRoute(origin, destination);
  }
}

export function getVietMapStaticMapUrl() {
  return "";
}

export function getVietMapPlaceMapUrl() {
  return "";
}

export function buildVietMapInteractiveMapHtml({
  center,
  markers = [],
  routeGeometry = null,
  zoom = 16,
  routeColor = "#ff7a00",
  draggableMarkerIndex = -1,
  fitPadding = null,
}) {
  assertVietMapKey();

  const safeCenter = center ?? markers[0] ?? { lat: 21.028511, lng: 105.804817 };
  const safeMarkers = markers.filter(Boolean);
  const safeRouteGeometry = routeGeometry ?? null;
  const apiKey = VIETMAP_API_KEY;

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

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 20,
        attribution: "OpenStreetMap",
      }).addTo(map);

      L.tileLayer("https://maps.vietmap.vn/api/tm/{z}/{x}/{y}.png?apikey=${apiKey}", {
        maxZoom: 20,
        attribution: "VietMap",
      }).addTo(map);

      const bounds = [];

      markers.forEach((marker, markerIndex) => {
        if (marker && Number.isFinite(marker.lat) && Number.isFinite(marker.lng)) {
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
                  "https://maps.vietmap.vn/api/reverse/v3?lat=" +
                    nextPoint.lat +
                    "&lng=" +
                    nextPoint.lng +
                    "&apikey=${apiKey}"
                );
                const reversePayload = await reverseResponse.json();
                const reverseResult = Array.isArray(reversePayload)
                  ? reversePayload[0]
                  : reversePayload?.data || reversePayload;
                formattedAddress =
                  reverseResult?.display ||
                  reverseResult?.address ||
                  reverseResult?.name ||
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
