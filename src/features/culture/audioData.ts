import type { AudioSource } from 'expo-audio';

export type KomuzTrack = {
  id: string;
  title: string;
  performer?: string;
  /** False when the title/performer above is a placeholder pending a real
   * name from the source material, not an actually-confirmed title. */
  titleConfirmed: boolean;
  source: AudioSource;
};

/** Recovered from filenames and (mojibake-corrected) ID3 tags on the mp3s
 * added under assets/audio/komuz/ - all are tagged SUPER.KG / www.super.kg,
 * the same source already cited for the beverages list in
 * content/culture/food.md. 9 of the 15 files carry no title/artist tag at
 * all, so those stay honestly labeled as unconfirmed rather than guessing
 * a name - same "don't invent content" standard as the rest of Culture. */
export const komuzTracks: KomuzTrack[] = [
  {
    id: 'ak-maral-min',
    title: 'Ак марал мин',
    titleConfirmed: true,
    source: require('@assets/audio/komuz/ak-maral-min.mp3'),
  },
  {
    id: 'komuz-kuusu-ak',
    title: 'Комуз күүсү',
    performer: 'АК',
    titleConfirmed: true,
    source: require('@assets/audio/komuz/komuz-kuusu-ak.mp3'),
  },
  {
    id: 'kokoy-kesti',
    title: 'Кокой кести',
    performer: 'К. Орозов',
    titleConfirmed: true,
    source: require('@assets/audio/komuz/kokoy-kesti-k-orozov.mp3'),
  },
  {
    id: 'toguz-kairyk',
    title: 'Тогуз кайрык',
    titleConfirmed: true,
    source: require('@assets/audio/komuz/toguz-kairyk.mp3'),
  },
  {
    id: 'uluu-koch',
    title: 'Улуу көч',
    performer: 'Асылбек Насирдинов',
    titleConfirmed: true,
    source: require('@assets/audio/komuz/uluu-koch-asylbek-nasirdinov.mp3'),
  },
  {
    id: 'chon-kerbez',
    title: 'Чоң кербез',
    titleConfirmed: true,
    source: require('@assets/audio/komuz/chon-kerbez.mp3'),
  },
  {
    id: 'komuz-melody-01',
    title: 'Комуз күүсү №1',
    titleConfirmed: false,
    source: require('@assets/audio/komuz/komuz-melody-01.mp3'),
  },
  {
    id: 'komuz-melody-02',
    title: 'Комуз күүсү №2',
    titleConfirmed: false,
    source: require('@assets/audio/komuz/komuz-melody-02.mp3'),
  },
  {
    id: 'komuz-melody-03',
    title: 'Комуз күүсү №3',
    titleConfirmed: false,
    source: require('@assets/audio/komuz/komuz-melody-03.mp3'),
  },
  {
    id: 'komuz-melody-04',
    title: 'Комуз күүсү №4',
    titleConfirmed: false,
    source: require('@assets/audio/komuz/komuz-melody-04.mp3'),
  },
  {
    id: 'komuz-melody-05',
    title: 'Комуз күүсү №5',
    titleConfirmed: false,
    source: require('@assets/audio/komuz/komuz-melody-05.mp3'),
  },
  {
    id: 'komuz-melody-06',
    title: 'Комуз күүсү №6',
    titleConfirmed: false,
    source: require('@assets/audio/komuz/komuz-melody-06.mp3'),
  },
  {
    id: 'komuz-melody-07',
    title: 'Комуз күүсү №7',
    titleConfirmed: false,
    source: require('@assets/audio/komuz/komuz-melody-07.mp3'),
  },
  {
    id: 'komuz-melody-08',
    title: 'Комуз күүсү №8',
    titleConfirmed: false,
    source: require('@assets/audio/komuz/komuz-melody-08.mp3'),
  },
  {
    id: 'komuz-melody-09',
    title: 'Комуз күүсү №9',
    titleConfirmed: false,
    source: require('@assets/audio/komuz/komuz-melody-09.mp3'),
  },
];

/** Which culture_items row shows this playlist - mirrors the
 * cultureItemImages lookup-by-id pattern in data.ts. */
export const cultureItemAudio: Record<string, KomuzTrack[]> = {
  'komuz-melodies': komuzTracks,
};
