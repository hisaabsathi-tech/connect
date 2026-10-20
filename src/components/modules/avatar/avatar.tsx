import { Image } from "expo-image";
import { View } from "react-native";

import { Text } from "@/components/modules/typography";

// Same generated fallback as the web app and connector-v1 (`blobsAvatarUrl`): DiceBear blobs in
// the brand blues, seeded by the user id so each person keeps one look everywhere.
const BLOBS_BACKGROUND = "f0f2ff,dbe4ff,8caaff";
const BLOBS_COLOR = "465fff,1f42d0";

function blobsAvatarUrl(seed: string) {
  return `https://api.dicebear.com/10.x/blobs/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${BLOBS_BACKGROUND}&blobColor=${BLOBS_COLOR}`;
}

/** "Suman Das" → "SD", "Suman" → "SU". */
export function initialsFromName(name: string) {
  const [first, second] = name.trim().split(/\s+/).filter(Boolean);
  if (!first) return "";
  if (!second) return first.slice(0, 2).toUpperCase();
  return `${first[0]}${second[0]}`.toUpperCase();
}

interface AvatarProps {
  /** The uploaded photo; falls back to the generated avatar. */
  image: string | null | undefined;
  name: string | null | undefined;
  /** User id that seeds the generated avatar. */
  seed: string | null | undefined;
  size: number;
  /** Round (header) or square (profile card). */
  round?: boolean;
}

/**
 * Photo, else the generated blobs avatar. The name's initials sit underneath, so the avatar is
 * never blank while the image loads or when it can't (offline, no id yet).
 */
export function Avatar({ image, name, round = false, seed, size }: AvatarProps) {
  const photo = image?.trim();
  const uri = photo || (seed ? blobsAvatarUrl(seed) : null);
  return (
    <View
      className={`items-center justify-center overflow-hidden bg-[#DBE4FF] ${round ? "rounded-full" : ""}`}
      style={{ height: size, width: size }}
    >
      <Text className="font-semibold text-primary" style={{ fontSize: Math.round(size * 0.36) }}>
        {initialsFromName(name ?? "")}
      </Text>
      {uri ? (
        <Image
          contentFit="cover"
          source={{ uri }}
          style={{ height: size, left: 0, position: "absolute", top: 0, width: size }}
        />
      ) : null}
    </View>
  );
}
