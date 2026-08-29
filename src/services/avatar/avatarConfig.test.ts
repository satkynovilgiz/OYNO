import { isValidAvatarConfig, sanitizeAvatarConfig } from './avatarConfig';
import { DEFAULT_AVATAR_CONFIG } from './defaultAvatar';

const VALID_IDS = {
  base: new Set(['male', 'female']),
  skinTone: new Set(['skin_01', 'skin_03']),
  hairColor: new Set(['black']),
  eyeColor: new Set(['brown']),
  faceShape: new Set(['oval', 'round']),
  eyebrows: new Set(['straight']),
  nose: new Set(['default']),
  mouth: new Set(['neutral']),
  body: new Set(['average']),
  eyes: new Set(['round']),
  hair: new Set(['hair_01']),
  headwear: new Set(['none']),
  clothing: new Set(['clothing_01']),
  accessory: new Set(['none']),
  background: new Set(['background_01']),
};

describe('isValidAvatarConfig', () => {
  it('accepts a well-formed config', () => {
    expect(isValidAvatarConfig(DEFAULT_AVATAR_CONFIG)).toBe(true);
  });

  it('rejects null/undefined', () => {
    expect(isValidAvatarConfig(null)).toBe(false);
    expect(isValidAvatarConfig(undefined)).toBe(false);
  });

  it('rejects a config missing a required field', () => {
    const { faceShape: _faceShape, ...missingFaceShape } = DEFAULT_AVATAR_CONFIG;
    expect(isValidAvatarConfig(missingFaceShape)).toBe(false);
  });

  it('rejects a config with a non-string field value', () => {
    expect(isValidAvatarConfig({ ...DEFAULT_AVATAR_CONFIG, faceShape: 42 })).toBe(false);
  });
});

describe('sanitizeAvatarConfig', () => {
  it('returns the defaults unchanged for null/undefined input', () => {
    expect(sanitizeAvatarConfig(null, VALID_IDS, DEFAULT_AVATAR_CONFIG)).toEqual(DEFAULT_AVATAR_CONFIG);
  });

  it('keeps a field whose value is a currently-valid id', () => {
    const result = sanitizeAvatarConfig({ faceShape: 'round' }, VALID_IDS, DEFAULT_AVATAR_CONFIG);
    expect(result.faceShape).toBe('round');
  });

  it('falls back to the default for a field referencing an id no longer in the catalog', () => {
    const result = sanitizeAvatarConfig({ faceShape: 'removed_item_id' as never }, VALID_IDS, DEFAULT_AVATAR_CONFIG);
    expect(result.faceShape).toBe(DEFAULT_AVATAR_CONFIG.faceShape);
  });

  it('fills every unspecified field from defaults, leaving no field undefined', () => {
    const result = sanitizeAvatarConfig({ faceShape: 'round' }, VALID_IDS, DEFAULT_AVATAR_CONFIG);
    expect(result).toEqual({ ...DEFAULT_AVATAR_CONFIG, faceShape: 'round' });
  });

  it('round-trips through JSON without losing or altering any field', () => {
    const roundTripped = JSON.parse(JSON.stringify(DEFAULT_AVATAR_CONFIG));
    expect(roundTripped).toEqual(DEFAULT_AVATAR_CONFIG);
  });
});
