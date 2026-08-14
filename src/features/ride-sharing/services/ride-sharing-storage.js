import * as SecureStore from "expo-secure-store";

const RIDE_SHARING_CARDS_STORAGE_KEY = "fpt-ride.ride-sharing-cards";

function getStorageKey(userId) {
  const normalizedUserId = String(userId ?? "").trim().toLowerCase();

  return normalizedUserId
    ? `${RIDE_SHARING_CARDS_STORAGE_KEY}.${normalizedUserId}`
    : RIDE_SHARING_CARDS_STORAGE_KEY;
}

function getCardKey(card) {
  return String(card?.requestId || card?.groupId || card?.id || "");
}

async function readRideSharingCards(userId) {
  const rawCards = await SecureStore.getItemAsync(getStorageKey(userId));

  if (!rawCards) {
    return [];
  }

  try {
    const parsedCards = JSON.parse(rawCards);
    return Array.isArray(parsedCards) ? parsedCards : [];
  } catch {
    return [];
  }
}

async function writeRideSharingCards(cards, userId) {
  await SecureStore.setItemAsync(
    getStorageKey(userId),
    JSON.stringify(cards ?? [])
  );
}

export async function loadStoredRideSharingCards(userId) {
  return readRideSharingCards(userId);
}

export async function persistRideSharingCards(cards, userId) {
  const storedCards = await readRideSharingCards(userId);
  const nextCards = [];
  const seenKeys = new Set();

  [...(cards ?? []), ...storedCards].forEach((card) => {
    const key = getCardKey(card);

    if (!key || seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    nextCards.push({
      ...card,
      storedAt: card?.storedAt || new Date().toISOString(),
    });
  });

  const limitedCards = nextCards.slice(0, 50);

  await writeRideSharingCards(limitedCards, userId);

  return limitedCards;
}

export async function replaceRideSharingCards(cards, userId) {
  const nextCards = (cards ?? []).filter(Boolean).slice(0, 50);
  await writeRideSharingCards(nextCards, userId);
  return nextCards;
}
