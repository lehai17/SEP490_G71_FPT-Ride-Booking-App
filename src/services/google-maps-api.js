const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_BASE_URL = "https://maps.googleapis.com/maps/api";
const DEFAULT_REGION_SUFFIX = "Việt Nam";

const ADDRESS_ALIASES = {
  "Đại học FPT, Thạch Hòa": [
    "Đại học FPT, Khu công nghệ cao Hòa Lạc, Hà Nội",
    "FPT University, Hà Nội, Việt Nam",
  ],
  "Đại học FPT": [
    "Đại học FPT, Khu công nghệ cao Hòa Lạc, Hà Nội",
    "FPT University, Hà Nội, Việt Nam",
  ],
  "Cổng chính Đại học FPT, Thạch Hòa, Hà Nội": [
    "Cổng chính Đại học FPT, Khu công nghệ cao Hòa Lạc, Hà Nội",
  ],
  "Bến xe Mỹ Đình": [
    "Bến xe Mỹ Đình, Phạm Hùng, Từ Liêm, Hà Nội",
  ],
  "Ngã tư Thạch Hòa": [
    "Ngã tư Thạch Hòa, Hà Nội",
  ],
};

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
  "Ngã tư Thạch Hòa": {
    formattedAddress: "Ngã tư Thạch Hòa, Hà Nội",
    location: { lat: 21.0185, lng: 105.5228 },
  },
};

function assertGoogleMapsKey() {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Thiếu EXPO_PUBLIC_GOOGLE_MAPS_API_KEY trong .env của FE.");
  }
}

function buildUrl(path, params) {
  assertGoogleMapsKey();

  const searchParams = new URLSearchParams({
    ...params,
    key: GOOGLE_MAPS_API_KEY,
  });

  return `${GOOGLE_MAPS_BASE_URL}/${path}/json?${searchParams.toString()}`;
}

function normalizeAddress(address) {
  const trimmedAddress = address.trim();

  if (!trimmedAddress) {
    return "";
  }

  return trimmedAddress.toLowerCase().includes("việt nam")
    ? trimmedAddress
    : `${trimmedAddress}, ${DEFAULT_REGION_SUFFIX}`;
}

function createAddressCandidates(address) {
  const baseAddress = normalizeAddress(address);
  const candidates = new Set([baseAddress]);
  const aliases = ADDRESS_ALIASES[address.trim()] ?? [];

  aliases.forEach((alias) => {
    candidates.add(alias);
    candidates.add(normalizeAddress(alias));
  });

  if (!baseAddress.toLowerCase().includes("hà nội")) {
    candidates.add(baseAddress.replace(/,\s*Việt Nam$/i, ", Hà Nội, Việt Nam"));
  }

  if (!baseAddress.toLowerCase().includes("việt nam")) {
    candidates.add(`${baseAddress}, Việt Nam`);
  }

  return Array.from(candidates).filter(Boolean);
}

function getBestGeocodeResult(results) {
  return results.find((item) => item.geometry?.location) ?? results[0];
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

function formatApproxDuration(distanceKm) {
  const estimatedMinutes = Math.max(1, Math.round((distanceKm / 30) * 60));

  if (estimatedMinutes < 60) {
    return `${estimatedMinutes} phút`;
  }

  const hours = Math.floor(estimatedMinutes / 60);
  const minutes = estimatedMinutes % 60;

  if (minutes === 0) {
    return `${hours} giờ`;
  }

  return `${hours} giờ ${minutes} phút`;
}

function createApproximateRoute(origin, destination) {
  const distanceKm = haversineDistanceKm(origin.location, destination.location);
  const distanceText = `${distanceKm.toFixed(1)} km`;
  const durationText = formatApproxDuration(distanceKm);

  return {
    distanceText,
    durationText,
    overviewPolyline: "",
    startAddress: origin.formattedAddress,
    endAddress: destination.formattedAddress,
    isFallbackRoute: true,
  };
}

export function isGoogleMapsConfigured() {
  return Boolean(GOOGLE_MAPS_API_KEY);
}

export async function verifyGoogleAddress(address) {
  if (!address.trim()) {
    throw new Error("Vui lòng nhập địa chỉ cần xác minh.");
  }

  let lastErrorMessage = "";
  const fallback = getFallbackGeocode(address);

  for (const candidate of createAddressCandidates(address)) {
    const response = await fetch(
      buildUrl("geocode", {
        address: candidate,
        region: "vn",
        language: "vi",
      })
    );

    if (!response.ok) {
      throw new Error("Không thể kết nối Google Maps để xác minh địa chỉ.");
    }

    const payload = await response.json();

    if (payload.status === "OK" && payload.results?.length) {
      const result = getBestGeocodeResult(payload.results);

      return {
        input: address,
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        location: result.geometry.location,
      };
    }

    lastErrorMessage =
      payload.error_message ||
      lastErrorMessage ||
      `Không tìm thấy địa chỉ "${address}" trên Google Maps.`;
  }

  if (fallback) {
    return {
      input: address,
      formattedAddress: fallback.formattedAddress,
      placeId: "",
      location: fallback.location,
    };
  }

  throw new Error(lastErrorMessage);
}

export async function getGoogleDirections(origin, destination) {
  const buildLocationValue = (point) =>
    point.placeId ? `place_id:${point.placeId}` : `${point.location.lat},${point.location.lng}`;

  try {
    const response = await fetch(
      buildUrl("directions", {
        origin: buildLocationValue(origin),
        destination: buildLocationValue(destination),
        mode: "driving",
        language: "vi",
        region: "vn",
      })
    );

    if (!response.ok) {
      return createApproximateRoute(origin, destination);
    }

    const payload = await response.json();

    if (payload.status === "ZERO_RESULTS" || !payload.routes?.length) {
      return createApproximateRoute(origin, destination);
    }

    if (payload.status !== "OK") {
      return createApproximateRoute(origin, destination);
    }

    const route = payload.routes[0];
    const leg = route.legs?.[0];

    return {
      distanceText: leg?.distance?.text ?? "",
      durationText: leg?.duration?.text ?? "",
      overviewPolyline: route.overview_polyline?.points ?? "",
      startAddress: leg?.start_address ?? origin.formattedAddress,
      endAddress: leg?.end_address ?? destination.formattedAddress,
      isFallbackRoute: false,
    };
  } catch {
    return createApproximateRoute(origin, destination);
  }
}

export function getGoogleStaticMapUrl({
  origin,
  destination,
  polyline,
  width = 640,
  height = 360,
}) {
  assertGoogleMapsKey();

  const params = new URLSearchParams({
    size: `${width}x${height}`,
    scale: "2",
    maptype: "roadmap",
    language: "vi",
    markers: `color:orange|label:D|${origin.location.lat},${origin.location.lng}`,
    key: GOOGLE_MAPS_API_KEY,
  });

  params.append(
    "markers",
    `color:red|label:K|${destination.location.lat},${destination.location.lng}`
  );

  if (polyline) {
    params.append("path", `color:0xff7a00ff|weight:5|enc:${polyline}`);
  } else {
    params.append(
      "path",
      `color:0xff7a00ff|weight:5|${origin.location.lat},${origin.location.lng}|${destination.location.lat},${destination.location.lng}`
    );
  }

  return `${GOOGLE_MAPS_BASE_URL}/staticmap?${params.toString()}`;
}
