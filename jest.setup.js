// Real AsyncStorage requires a native module that doesn't exist under
// Jest - every store in this app touches it at import time (even ones a
// given test doesn't call), so this needs to be global setup, not a
// per-test-file mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
