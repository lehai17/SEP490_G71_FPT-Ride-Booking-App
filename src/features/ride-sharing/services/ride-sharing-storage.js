// RIDE SHARING STORAGE - Lưu cache thẻ đi ghép trên thiết bị
// ================================================================
// Comment tiếng Việt được đặt phía trên từng khối để giải thích vai trò code.
// Logic hiện tại được giữ nguyên, chỉ bổ sung mô tả cho dễ đọc/bảo trì.
// ================================================================

import {
  getPersistentItem,
  setPersistentItem,
} from "@/services/persistent-storage";

// Hằng số cấu hình: Giá trị dùng chung trong file, tránh hard-code lặp lại
const RIDE_SHARING_CARDS_STORAGE_KEY = "fpt-ride.ride-sharing-cards";

// getStorageKey: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getStorageKey(userId) {
  const normalizedUserId = String(userId ?? "").trim().toLowerCase();

  return normalizedUserId
    ? `${RIDE_SHARING_CARDS_STORAGE_KEY}.${normalizedUserId}`
    : RIDE_SHARING_CARDS_STORAGE_KEY;
}

// getCardKey: Hàm xử lý một phần logic riêng để màn hình/service dễ đọc và dễ bảo trì
function getCardKey(card) {
  return String(card?.requestId || card?.groupId || card?.id || "");
}

async function readRideSharingCards(userId) {
  const rawCards = await getPersistentItem(getStorageKey(userId));

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
  await setPersistentItem(
    getStorageKey(userId),
    JSON.stringify(cards ?? [])
  );
}

// loadStoredRideSharingCards: Hàm async gọi API hoặc xử lý dữ liệu bất đồng bộ
export async function loadStoredRideSharingCards(userId) {
  return readRideSharingCards(userId);
}

// persistRideSharingCards: Hàm async gọi API hoặc xử lý dữ liệu bất đồng bộ
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

// replaceRideSharingCards: Hàm async gọi API hoặc xử lý dữ liệu bất đồng bộ
export async function replaceRideSharingCards(cards, userId) {
  const nextCards = (cards ?? []).filter(Boolean).slice(0, 50);
  await writeRideSharingCards(nextCards, userId);
  return nextCards;
}
