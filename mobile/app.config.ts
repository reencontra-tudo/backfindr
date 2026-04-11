import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Backfindr',
  slug: 'backfindr',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './src/assets/icon.png',
  scheme: 'backfindr',
  userInterfaceStyle: 'dark',
  splash: {
    backgroundColor: '#0f172a',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.backfindr.app',
    infoPlist: {
      NSCameraUsageDescription: 'Usado para escanear QR Codes e fotografar objetos.',
      NSPhotoLibraryUsageDescription: 'Usado para adicionar fotos aos objetos registrados.',
      NSLocationWhenInUseUsageDescription: 'Usado para registrar a localização do objeto perdido.',
    },
  },
  android: {
    adaptiveIcon: { backgroundColor: '#0f172a' },
    package: 'com.backfindr.app',
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'ACCESS_FINE_LOCATION',
    ],
  },
  plugins: [
    'expo-router',
    'expo-camera',
    'expo-location',
    ['expo-notifications', { icon: './src/assets/icon.png', color: '#14b8a6' }],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000',
    eas: { projectId: 'your-eas-project-id' },
  },
});
