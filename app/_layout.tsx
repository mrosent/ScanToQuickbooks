import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, View, Text } from "react-native";

function HeaderLogo() {
  return (
    <View style={{ marginLeft: 16, marginRight: 8 }}>
      <Image
        source={require("../assets/icon.png")}
        style={{ width: 32, height: 32 }}
        resizeMode="contain"
      />
    </View>
  );
}

function HeaderTitle() {
  const pathname = usePathname();
  const title = pathname.includes("history") ? "History" : "Dashboard";
  return <Text style={{ fontSize: 17, fontWeight: "600", color: "#000000" }}>{title}</Text>;
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: true,
            headerLeft: () => <HeaderLogo />,
            headerTitle: () => <HeaderTitle />,
            headerStyle: { backgroundColor: "#ffffff" },
            headerTintColor: "#000000",
            headerTitleStyle: { fontWeight: "600", fontSize: 17 },
          }}
        />
      </Stack>
    </>
  );
}
