// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 3D games need to bundle real GLB/GLTF character/horse models eventually
// (docs/GAME_ASSETS.md) - Expo's default Metro config doesn't treat these
// as bindable assets out of the box.
config.resolver.assetExts.push('glb', 'gltf', 'bin');

module.exports = config;
