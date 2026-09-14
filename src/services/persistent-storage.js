import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

function getWebStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage ?? null;
}

export async function getPersistentItem(key) {
  if (Platform.OS === "web") {
    return getWebStorage()?.getItem(key) ?? null;
  }

  return SecureStore.getItemAsync(key);
}

export async function setPersistentItem(key, value) {
  if (Platform.OS === "web") {
    getWebStorage()?.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

export async function deletePersistentItem(key) {
  if (Platform.OS === "web") {
    getWebStorage()?.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}
