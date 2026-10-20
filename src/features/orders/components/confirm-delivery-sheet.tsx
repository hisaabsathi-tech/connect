import { Camera01Icon, Delete02Icon, Image01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { ActionButton, TextButton } from "@/components/modules/button";
import { OtpField } from "@/components/modules/form";
import { type PhotoSource, photoPickError, pickPhoto } from "@/components/modules/photo";
import { BottomSheet } from "@/components/modules/sheet";
import { Text } from "@/components/modules/typography";
import { useToast } from "@/components/ui/toast";
import { colors } from "@/config/colors";
import { uploadOrderPod } from "@/lib/api/media";
import { resendDeliveryOtp, setShipmentStatus } from "@/lib/api/order-tracking";
import { useAuthSession } from "@/lib/auth/session";
import { errorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { lastPosition } from "@/lib/maps/last-position";

import type { DrsOrder } from "../lib/orders";

const OTP_LENGTH = 6;
const OTP_CODE = /^\d{6}$/;

function SourceButton({
  icon,
  label,
  onPress,
}: {
  icon: typeof Camera01Icon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="h-12 flex-1 flex-row items-center justify-center gap-2 border border-dashed border-primary bg-[#F7F8FF] active:bg-accent"
      onPress={onPress}
      onPressIn={() => haptic("light")}
    >
      <HugeiconsIcon color={colors.primary} icon={icon} size={18} strokeWidth={1.8} />
      <Text className="text-sm font-medium text-primary">{label}</Text>
    </Pressable>
  );
}

/**
 * "Confirm delivery", as in Connector v1: the receiver's delivery OTP when the order asks for one
 * (with Resend), an optional proof-of-delivery photo, then Confirm marks the order delivered.
 * An OTP, once entered, must be all 6 digits; the server checks it.
 */
export function ConfirmDeliverySheet({
  onClose,
  onDelivered,
  order,
  visible,
}: {
  onClose: () => void;
  onDelivered: () => void;
  order: DrsOrder;
  visible: boolean;
}) {
  const { token } = useAuthSession();
  const toast = useToast();
  const [otp, setOtp] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);

  // Every opening starts clean.
  useEffect(() => {
    if (!visible) return;
    setOtp("");
    setPhoto(null);
    setMessage(null);
  }, [visible]);

  const choosePhoto = async (source: PhotoSource) => {
    setMessage(null);
    try {
      const uri = await pickPhoto(source, { crop: "free", frontCamera: false });
      if (uri) setPhoto(uri);
    } catch (error) {
      setMessage(photoPickError(error));
    }
  };

  const resend = async () => {
    if (!token || resending) return;
    setResending(true);
    setMessage(null);
    try {
      await resendDeliveryOtp(token, order.orderId);
      toast.success("Delivery OTP sent", "A new code has gone to the receiver.");
    } catch (error) {
      setMessage(errorMessage(error, "Couldn't send the OTP. Please try again."));
    } finally {
      setResending(false);
    }
  };

  const confirm = async () => {
    if (!token || saving) return;
    const code = otp.trim();
    if (code && !OTP_CODE.test(code)) {
      setMessage("Enter all 6 digits of the delivery OTP.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const scanCopy = photo ? (await uploadOrderPod(token, photo)).objectKey : undefined;
      await setShipmentStatus(token, order.orderId, {
        otp: code || undefined,
        scanCopy,
        shipmentStatus: "DELIVERED",
        ...(await lastPosition()),
      });
      haptic("success");
      toast.success("Order delivered", `${order.awbNo} is marked delivered.`);
      onDelivered();
    } catch (error) {
      haptic("error");
      setMessage(errorMessage(error, "Couldn't confirm this delivery. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet dismissible={!saving} onClose={onClose} visible={visible}>
      <Text className="mt-5 text-xl font-semibold text-foreground">Confirm delivery</Text>
      <Text className="mt-1 text-sm text-muted-foreground">
        Mark this order delivered once the receiver has it.
      </Text>

      {order.deliveryOtpRequired ? (
        <View className="mt-5">
          <OtpField label="Delivery OTP" length={OTP_LENGTH} onChangeText={setOtp} value={otp} />
          <View className="mt-2 self-start">
            <TextButton
              disabled={resending}
              label={resending ? "Sending…" : "Resend OTP"}
              onPress={() => void resend()}
            />
          </View>
        </View>
      ) : null}

      <Text className="mt-5 text-sm font-medium text-foreground">
        Proof of delivery <Text className="font-normal text-muted-foreground">(optional)</Text>
      </Text>
      {photo ? (
        <View className="mt-2">
          <Image
            contentFit="cover"
            source={{ uri: photo }}
            style={{ height: 160, width: "100%" }}
          />
          <Pressable
            accessibilityLabel="Remove the photo"
            accessibilityRole="button"
            className="absolute top-2 right-2 h-9 w-9 items-center justify-center bg-white active:opacity-80"
            onPress={() => setPhoto(null)}
          >
            <HugeiconsIcon color={colors.destructive} icon={Delete02Icon} size={18} />
          </Pressable>
        </View>
      ) : (
        <View className="mt-2 flex-row gap-3">
          <SourceButton
            icon={Camera01Icon}
            label="Camera"
            onPress={() => void choosePhoto("camera")}
          />
          <SourceButton
            icon={Image01Icon}
            label="Gallery"
            onPress={() => void choosePhoto("gallery")}
          />
        </View>
      )}

      {message ? <Text className="mt-4 text-sm text-destructive">{message}</Text> : null}
      <View className="mt-6">
        <ActionButton
          arrow={false}
          label="Confirm"
          loading={saving}
          onPress={() => void confirm()}
        />
      </View>
    </BottomSheet>
  );
}
