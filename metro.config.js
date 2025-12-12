// Metro configuration for React Native with Expo
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add custom resolver settings if needed
config.resolver.assetExts.push(
  'db',
  'mp3',
  'ttf',
  'otf',
  'json'
);

module.exports = config;
