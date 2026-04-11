import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: Colors.surface.card,
          borderTopColor: Colors.surface.border,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.brand[500],
        tabBarInactiveTintColor: Colors.text.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerStyle: {
          backgroundColor: Colors.surface.card,
          borderBottomColor: Colors.surface.border,
          borderBottomWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: Colors.text.primary,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
          headerTitle: 'Backfindr',
        }}
      />
      <Tabs.Screen
        name="objects"
        options={{
          title: 'Objetos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
          headerTitle: 'Meus Objetos',
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Escanear',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name="qr-code-outline"
              size={focused ? size + 4 : size}
              color={focused ? Colors.brand[500] : color}
            />
          ),
          headerTitle: 'Escanear QR Code',
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flash-outline" size={size} color={color} />
          ),
          headerTitle: 'Matches',
          tabBarBadge: undefined, // Set dynamically in app state
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
          headerTitle: 'Meu Perfil',
        }}
      />
    </Tabs>
  );
}
