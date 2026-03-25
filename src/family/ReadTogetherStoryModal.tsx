import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import type { ReadTogetherStoryCard } from "./readTogetherStoryCards";

const MODAL_BG = "#faf5ff";
const DOT_ACTIVE = "#6366f1";
const DOT_REST = "#e9d5ff";
const CARD_RADIUS = 16;

type ReadTogetherStoryModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  safeAreaTop: number;
  safeAreaBottom: number;
  stepIndex: number;
  cards: ReadTogetherStoryCard[];
  onStepBack: () => void;
  onStepNext: () => void;
  onFinished: () => void;
  onOpenPublishedUrl: (rawUrl: string) => void;
  primaryFill?: string;
  primaryFillPressed?: string;
  accentBorder?: string;
  accentBg?: string;
  accentBgPressed?: string;
};

export function ReadTogetherStoryModal({
  visible,
  onRequestClose,
  safeAreaTop,
  safeAreaBottom,
  stepIndex,
  cards,
  onStepBack,
  onStepNext,
  onFinished,
  onOpenPublishedUrl,
  primaryFill = "#4f46e5",
  primaryFillPressed = "#4338ca",
  accentBorder = "#c4b5fd",
  accentBg = "#ede9fe",
  accentBgPressed = "#ddd6fe",
}: ReadTogetherStoryModalProps) {
  const total = cards.length;
  const safeIndex = Math.min(Math.max(0, stepIndex), Math.max(0, total - 1));
  const card = total > 0 ? cards[safeIndex]! : null;
  const textPrimary = "#111827";
  const textSecondary = "#4b5563";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onRequestClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: MODAL_BG,
          paddingTop: safeAreaTop + 12,
          paddingBottom: safeAreaBottom + 16,
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: "600",
              color: "#5b4d7a",
              letterSpacing: 0.4,
            }}
          >
            Read together · {total > 0 ? safeIndex + 1 : 0} of {total}
          </Text>
          <Pressable
            onPress={onRequestClose}
            accessibilityRole="button"
            accessibilityLabel="Close story"
            hitSlop={8}
            style={({ pressed }) => ({
              paddingVertical: 6,
              paddingHorizontal: 4,
              marginRight: -4,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: primaryFill,
              }}
            >
              Close
            </Text>
          </Pressable>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 7,
            marginBottom: 14,
          }}
          accessibilityRole="none"
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              style={{
                width: i === safeIndex ? 7 : 6,
                height: i === safeIndex ? 7 : 6,
                borderRadius: 999,
                backgroundColor: i === safeIndex ? DOT_ACTIVE : DOT_REST,
              }}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ))}
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {card ? (
            <>
              {card.eyebrow ? (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    letterSpacing: 1,
                    color: "#6d28d9",
                    marginBottom: 8,
                  }}
                >
                  {card.eyebrow.toUpperCase()}
                </Text>
              ) : null}
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "700",
                  color: textPrimary,
                  lineHeight: 32,
                  marginBottom: card.headline ? 10 : 12,
                }}
              >
                {card.title}
              </Text>
              {card.headline ? (
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "700",
                    color: textPrimary,
                    lineHeight: 28,
                    marginBottom: 12,
                  }}
                >
                  {card.headline}
                </Text>
              ) : null}
              <Text style={{ fontSize: 16, color: textSecondary, lineHeight: 24 }}>
                {card.body}
              </Text>
              {card.familyLinkUrl ? (
                <Pressable
                  onPress={() => onOpenPublishedUrl(card.familyLinkUrl!)}
                  style={({ pressed }) => ({
                    marginTop: 18,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: CARD_RADIUS,
                    borderWidth: 1,
                    borderColor: accentBorder,
                    backgroundColor: pressed ? accentBgPressed : accentBg,
                    alignSelf: "stretch",
                    alignItems: "center",
                  })}
                >
                  <Text style={{ fontSize: 16, fontWeight: "800", color: primaryFill }}>
                    {(card.familyLinkLabel ?? "").trim() || "Open link"}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
          {safeIndex > 0 ? (
            <Pressable
              onPress={onStepBack}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: CARD_RADIUS,
                borderWidth: 1,
                borderColor: accentBorder,
                backgroundColor: pressed ? accentBgPressed : accentBg,
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: textPrimary }}>Back</Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {safeIndex < total - 1 ? (
            <Pressable
              onPress={onStepNext}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: CARD_RADIUS,
                backgroundColor: pressed ? primaryFillPressed : primaryFill,
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>Next</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onFinished}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: CARD_RADIUS,
                backgroundColor: pressed ? primaryFillPressed : primaryFill,
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>Done</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
