import { Stack, router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

const UI = {
  screenBg: "#f3f4f6",
  bgCard: "#ffffff",
  border: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#4b5563",
};

export default function CoachTemplatesScreen() {
  const handleUseTemplate = (templateId: string) => {
    router.push({
      pathname: "/profile/coaches/template-preview",
      params: { templateId },
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: "Program Pack Templates" }} />
      <ScrollView style={{ flex: 1, backgroundColor: UI.screenBg }} contentContainerStyle={{ padding: 16 }}>
        <Pressable
          onPress={() => router.push("/profile/coaches/create-pack")}
          style={{
            marginBottom: 10,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: UI.border,
            backgroundColor: UI.bgCard,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontSize: 14, color: UI.textPrimary }}>Back to Create Program Pack</Text>
        </Pressable>

        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 6, color: UI.textPrimary }}>
          Coach Share · Templates
        </Text>
        <Text style={{ fontSize: 14, color: UI.textSecondary, lineHeight: 20 }}>
          Browse a few starter program packs you can use as realistic examples
          for Coach Share. These are demo-only and do not yet save or publish
          anything.
        </Text>

        <View style={{ marginTop: 16, gap: 12 }}>
          <View
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: UI.textPrimary }}>
              Guard Pull Defense — Knee in the Middle
            </Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
              Learn to deny a clean guard pull by winning inside position,
              inserting the knee line early, and stabilizing posture before the
              bottom player settles underneath.
            </Text>
            <Text style={{ marginTop: 8, fontSize: 12, color: UI.textSecondary }}>
              Modules: 3 · Focus: Gi / Top Player · Level: Fundamentals
            </Text>
            <Pressable
              onPress={() =>
                handleUseTemplate("guard-pull-defense-knee-middle")
              }
              style={{
                marginTop: 10,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ fontSize: 14, color: UI.textPrimary }}>Use This Template</Text>
            </Pressable>
          </View>

          <View
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: UI.textPrimary }}>
              Triangle Defense — Posture and Escape
            </Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
              Build a calm triangle escape sequence by restoring posture,
              creating angle awareness, protecting the trapped shoulder line,
              and working toward a safe finish to the escape.
            </Text>
            <Text style={{ marginTop: 8, fontSize: 12, color: UI.textSecondary }}>
              Modules: 3 · Focus: Gi / Defense · Level: Fundamentals
            </Text>
            <Pressable
              onPress={() =>
                handleUseTemplate("triangle-defense-posture-escape")
              }
              style={{
                marginTop: 10,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ fontSize: 14, color: UI.textPrimary }}>Use This Template</Text>
            </Pressable>
          </View>

          <View
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: UI.border,
              backgroundColor: UI.bgCard,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: UI.textPrimary }}>
              Half Guard Passing — Heavy Chest and Table Hands
            </Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: UI.textSecondary }}>
              Practice staying heavy on top while passing half guard, using
              chest pressure, table hands, and patient balance to prevent the
              bottom player from recovering guard.
            </Text>
            <Text style={{ marginTop: 8, fontSize: 12, color: UI.textSecondary }}>
              Modules: 3 · Focus: Top Pressure / Passing · Level: Fundamentals
            </Text>
            <Pressable
              onPress={() =>
                handleUseTemplate("half-guard-passing-heavy-chest-table-hands")
              }
              style={{
                marginTop: 10,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: UI.border,
                backgroundColor: UI.bgCard,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ fontSize: 14, color: UI.textPrimary }}>Use This Template</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

