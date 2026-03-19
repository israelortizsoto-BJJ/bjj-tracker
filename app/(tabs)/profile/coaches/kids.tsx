import { Stack, router } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  getKidsById,
  setKidsById,
} from "../../../../src/storage/coachKidStore";
import type { Kid, KidsById } from "../../../../src/types/coachKid";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
};

const CARD_RADIUS = 16;

export default function KidsRosterScreen() {
  const [ready, setReady] = useState(false);
  const [kidsById, setKidsByIdState] = useState<KidsById>({});
  const [kidName, setKidName] = useState("");
  const [savingKid, setSavingKid] = useState(false);

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

  const kids = Object.values(kidsById).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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
      const created: Kid = {
        id,
        name: trimmed,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const next: KidsById = { ...existing, [id]: created };
      await setKidsById(next);
      setKidsByIdState(next);
      setKidName("");

      router.replace(`/profile/coaches/kid/${id}`);
    } finally {
      setSavingKid(false);
    }
  }, [kidName]);

  return (
    <>
      <Stack.Screen options={{ title: "Kids (Pilot)" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: UI.screenBg }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
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
          <View style={{ gap: 10, marginTop: 10 }}>
            {kids.map((kid) => (
              <Pressable
                key={kid.id}
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
      </ScrollView>
    </>
  );
}

