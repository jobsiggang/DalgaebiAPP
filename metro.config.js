// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 안전하게 assetExts를 재정의하는 방식
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'db',
  'mp3',
  'ttf',
  'otf',
  'json'
];

module.exports = config;
