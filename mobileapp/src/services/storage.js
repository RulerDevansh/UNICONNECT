import AsyncStorage from '@react-native-async-storage/async-storage';

export const tokenStorage = {
  getAccessToken: () => AsyncStorage.getItem('accessToken'),
  getRefreshToken: () => AsyncStorage.getItem('refreshToken'),
  setTokens: async ({ accessToken, refreshToken }) => {
    const writes = [];
    if (accessToken) writes.push(['accessToken', accessToken]);
    if (refreshToken) writes.push(['refreshToken', refreshToken]);
    if (writes.length) await AsyncStorage.multiSet(writes);
  },
  clear: () => AsyncStorage.multiRemove(['accessToken', 'refreshToken']),
};

