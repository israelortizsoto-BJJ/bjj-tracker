import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  deleteKidPilot,
  getKidsById,
  normalizeKidHouseholdLabel,
  setKidsById,
} from "../../../../src/storage/coachKidStore";
import type { Kid, KidsById } from "../../../../src/types/coachKid";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
  deleteBg: "#dc2626",
  deleteText: "#ffffff",
};

const CARD_RADIUS = 16;

/** Internal map key for kids with no household label (displayed as "No household"). */
const UNGROUPED_HOUSEHOLD_KEY = "__ungrouped__";

function householdSectionKey(kid: Kid): string {
  const t = normalizeKidHouseholdLabel(kid.householdLabel ?? "");
  return t ? t : UNGROUPED_HOUSEHOLD_KEY;
}

function householdSectionTitle(sectionKey: string): string {
  return sectionKey === UNGROUPED_HOUSEHOLD_KEY ? "No household" : sectionKey;
}

function buildHouseholdSections(kids: Kid[]): { sectionKey: string; title: string; kids: Kid[] }[] {
  const map = new Map<string, Kid[]>();
  for (const kid of kids) {
    const key = householdSectionKey(kid);
    const arr = map.get(key) ?? [];
    arr.push(kid);
    map.set(key, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a === UNGROUPED_HOUSEHOLD_KEY && b !== UNGROUPED_HOUSEHOLD_KEY) return 1;
    if (b === UNGROUPED_HOUSEHOLD_KEY && a !== UNGROUPED_HOUSEHOLD_KEY) return -1;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  return keys.map((sectionKey) => ({
    sectionKey,
    title: householdSectionTitle(sectionKey),
    kids: map.get(sectionKey) ?? [],
  }));
}

export default function KidsRosterScreen() {
  const [ready, setReady] = useState(false);
  const [kidsById, setKidsByIdState] = useState<KidsById>({});
  const [kidName, setKidName] = useState("");
  const [householdLabelDraft, setHouseholdLabelDraft] = useState("");
  const [savingKid, setSavingKid] = useState(false);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const loadKids = useCallback(async () => {
    setReady(false);
    try {
      const kids = await getKidsById();
      setKidsByIdState(kids);
    } finally {
      setReady(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadKids();
    }, [loadKids]),
  );

  const { kids, householdSections } = useMemo(() => {
    const sorted = Object.values(kidsById).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return { kids: sorted, householdSections: buildHouseholdSections(sorted) };
  }, [kidsById]);

  const onConfirmDeleteKid = useCallback(
    async (kid: Kid) => {
      const ok = await deleteKidPilot(kid.id);
      if (ok) {
        setKidsByIdState((prev) => {
          const { [kid.id]: _r, ...rest } = prev;
          return rest;
        });
      }
    },
    [],
  );

  const requestDeleteKid = useCallback(
    (kid: Kid) => {
      Alert.alert(
        "Delete kid?",
        `Remove ${kid.name} from the pilot roster? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => void onConfirmDeleteKid(kid),
          },
        ],
      );
    },
    [onConfirmDeleteKid],
  );

  const onAddKid = useCallback(async () => {
    const trimmed = kidName.trim();
    if (!trimmed) {
      Alert.alert("Kid name required", "Add a kid name to create this pilot roster entry.");
      return;
    }

    setSavingKid(true);
    try {
      const nowIso = new Date().toISOString();
      const id = `kid_${Date.now()}`;

      const existing = await getKidsById();
      const labelNorm = normalizeKidHouseholdLabel(householdLabelDraft);
      const created: Kid = {
        id,
        name: trimmed,
        ...(labelNorm ? { householdLabel: labelNorm } : {}),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const next: KidsById = { ...existing, [id]: created };
      await setKidsById(next);
      setKidsByIdState(next);
      setKidName("");
      setHouseholdLabelDraft("");

      router.replace(`/profile/coaches/kid/${id}`);
    } finally {
      setSavingKid(false);
    }
  }, [kidName, householdLabelDraft]);

  return (
    <>
      <Stack.Screen options={{ title: "Kids (Pilot)" }} />
      <View style={{ flex: 1, backgroundColor: UI.screenBg }}>
        <KeyboardAwareScrollView
          enableOnAndroid
          enableAutomaticScroll
          enableResetScrollToCoords={false}
          keyboardOpeningTime={120}
          viewIsInsideTabBar
          extraHeight={headerHeight}
          extraScrollHeight={Math.max(32, insets.bottom + 16)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          style={{ flex: 1, backgroundColor: UI.screenBg }}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: Math.max(24, insets.bottom + 20),
          }}
        >
        <Pressable
          onPress={() => router.push("/profile/coaches")}
          style={({ pressed }) => ({
            marginBottom: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
            alignSelf: "flex-start",
          })}
        >
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Coach Tools</Text>
        </Pressable>

        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6, color: UI.textPrimary }}>
          Kids (Pilot)
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          Internal pilot roster. Choose a kid to set weekly focus and view kid history.
        </Text>

        <View style={{ height: 14 }} />

        {!ready ? (
          <Text style={{ fontSize: 14, color: UI.textSecondary }}>Loading kids…</Text>
        ) : kids.length === 0 ? (
          <View
            style={{
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              gap: 6,
            }}
          >
            <Text style={{ color: UI.textPrimary, fontWeight: "700" }}>No kids yet</Text>
            <Text style={{ color: UI.textSecondary, fontSize: 13 }}>
              Add a kid to start tracking weekly focus locally.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 18, marginTop: 10 }}>
            {householdSections.map(({ sectionKey, title, kids: sectionKids }) => (
              <View key={sectionKey} style={{ gap: 10 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: UI.textPrimary,
                    letterSpacing: 0.2,
                  }}
                >
                  {title}
                </Text>
                <View style={{ gap: 10 }}>
                  {sectionKids.map((kid) => (
                    <Swipeable
                      key={kid.id}
                      overshootRight={false}
                      renderRightActions={() => (
                        <Pressable
                          onPress={() => requestDeleteKid(kid)}
                          style={({ pressed }) => ({
                            justifyContent: "center",
                            backgroundColor: pressed ? "#b91c1c" : UI.deleteBg,
                            borderRadius: 12,
                            marginLeft: 8,
                            paddingHorizontal: 20,
                          })}
                        >
                          <Text
                            style={{
                              color: UI.deleteText,
                              fontWeight: "800",
                              fontSize: 15,
                            }}
                          >
                            Delete
                          </Text>
                        </Pressable>
                      )}
                    >
                      <Pressable
                        onPress={() => router.push(`/profile/coaches/kid/${kid.id}`)}
                        style={({ pressed }) => ({
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: UI.border,
                          backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        })}
                      >
                        <Text style={{ fontSize: 16, color: UI.textPrimary, fontWeight: "700" }}>
                          {kid.name}
                        </Text>
                        <Text style={{ color: UI.textSecondary, fontSize: 18 }}>›</Text>
                      </Pressable>
                    </Swipeable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 18 }} />

        <View
          style={{
            padding: 16,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: "600", color: UI.textSecondary }}>
            ADD KID (PILOT)
          </Text>
          <TextInput
            value={kidName}
            onChangeText={setKidName}
            placeholder="Kid name"
            placeholderTextColor={UI.textSecondary}
            autoCapitalize="words"
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              color: UI.textPrimary,
            }}
          />
          <TextInput
            value={householdLabelDraft}
            onChangeText={setHouseholdLabelDraft}
            placeholder="Household (optional)"
            placeholderTextColor={UI.textSecondary}
            autoCapitalize="words"
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
              color: UI.textPrimary,
            }}
          />
          <Pressable
            disabled={savingKid}
            onPress={() => void onAddKid()}
            style={({ pressed }) => ({
              marginTop: 4,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: pressed ? "#edf2ff" : UI.bgCard,
              opacity: savingKid ? 0.6 : 1,
              alignItems: "center",
            })}
          >
            <Text style={{ fontSize: 15, color: UI.textPrimary, fontWeight: "800" }}>
              Save Kid
            </Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: UI.textSecondary }}>
            Internal pilot (coach-side). No sharing with families yet.
          </Text>
        </View>
        </KeyboardAwareScrollView>
      </View>
    </>
  );
}
