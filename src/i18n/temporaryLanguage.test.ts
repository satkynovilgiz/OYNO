import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';

import { changeLanguageTemporarily } from './index';

describe('changeLanguageTemporarily', () => {
  it('switches the UI language but keeps the saved choice', async () => {
    await AsyncStorage.setItem('oyno.language', 'ru');
    await changeLanguageTemporarily('en');
    expect(i18n.language).toBe('en');
    expect(await AsyncStorage.getItem('oyno.language')).toBe('ru');
  });
  it('leaves no saved choice when there was none', async () => {
    await AsyncStorage.removeItem('oyno.language');
    await changeLanguageTemporarily('ru');
    expect(await AsyncStorage.getItem('oyno.language')).toBeNull();
  });
});
