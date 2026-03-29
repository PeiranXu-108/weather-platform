import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#111c2d', borderTopColor: '#1a2a40' },
        tabBarActiveTintColor: '#61a7ff',
        tabBarInactiveTintColor: '#8aa0c1',
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: '首页',
        }}
      />
    </Tabs>
  );
}
