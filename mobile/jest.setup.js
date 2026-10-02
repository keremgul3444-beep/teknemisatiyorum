// Yerel depolama modülü testte yoktur; paketin kendi bellek içi taklidi kullanılır.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
