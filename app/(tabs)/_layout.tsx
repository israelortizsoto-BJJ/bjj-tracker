import { Tabs } from "expo-router";
import { isDev } from "../../src/config/runtime";

const HIDDEN = { href: null } as const;

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      {isDev()
        ? [
            <Tabs.Screen key="welcome" name="welcome" options={{ title: "Welcome" }} />,
            <Tabs.Screen key="profile" name="profile" options={{ title: "Profile" }} />,
            <Tabs.Screen key="training" name="training" options={{ title: "Training" }} />,
            <Tabs.Screen key="Fundamentals" name="Fundamentals" options={{ title: "Fundamentals" }} />,
            <Tabs.Screen key="gear" name="gear" options={{ title: "Gear" }} />,
            <Tabs.Screen key="profile/dev-settings" name="profile/dev-settings" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/index" name="profile/coaches/index" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/join" name="profile/coaches/join" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/manage" name="profile/coaches/manage" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/create-pack" name="profile/coaches/create-pack" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/templates" name="profile/coaches/templates" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/template-preview" name="profile/coaches/template-preview" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/template-selected" name="profile/coaches/template-selected" options={HIDDEN} />,
            <Tabs.Screen key="training/[id]" name="training/[id]" options={HIDDEN} />,
            <Tabs.Screen key="health" name="health" options={HIDDEN} />,
          ]
        : [
            <Tabs.Screen key="welcome" name="welcome" options={{ title: "Welcome" }} />,
            <Tabs.Screen key="profile" name="profile" options={{ title: "Profile" }} />,
            <Tabs.Screen key="training" name="training" options={{ title: "Training" }} />,
            <Tabs.Screen key="Fundamentals" name="Fundamentals" options={{ title: "Fundamentals" }} />,
            <Tabs.Screen key="gear" name="gear" options={{ title: "Gear" }} />,
            <Tabs.Screen key="profile/dev-settings" name="profile/dev-settings" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/index" name="profile/coaches/index" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/join" name="profile/coaches/join" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/manage" name="profile/coaches/manage" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/create-pack" name="profile/coaches/create-pack" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/templates" name="profile/coaches/templates" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/template-preview" name="profile/coaches/template-preview" options={HIDDEN} />,
            <Tabs.Screen key="profile/coaches/template-selected" name="profile/coaches/template-selected" options={HIDDEN} />,
            <Tabs.Screen key="training/[id]" name="training/[id]" options={HIDDEN} />,
            <Tabs.Screen key="health" name="health" options={HIDDEN} />,
          ]}
    </Tabs>
  );
}