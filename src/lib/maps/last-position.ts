import * as Location from "expo-location";

/**
 * Where the phone last was, if location is already allowed (it never asks); empty otherwise.
 * Spread into an update so the server can note where it was made.
 */
export async function lastPosition(): Promise<{ latitude?: number; longitude?: number }> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return {};
    const position = await Location.getLastKnownPositionAsync();
    return position
      ? { latitude: position.coords.latitude, longitude: position.coords.longitude }
      : {};
  } catch {
    return {};
  }
}
