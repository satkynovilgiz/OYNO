-- Container row for the Komuz melodies playlist added under
-- assets/audio/komuz/ - the track list itself (titles, performers, and the
-- bundled audio files) lives client-side in
-- src/features/culture/audioData.ts, same reasoning as cultureItemImages
-- in data.ts: RN's require() needs a static literal path, so a DB-supplied
-- file reference could never resolve one. This row just gives the
-- playlist a place to attach in the Komuz category list.

insert into public.culture_items (id, category_id, title, accuracy_level, sort_order) values
  ('komuz-melodies', 'komuz', 'Комуз күүлөрү', 'unverified', 0);
