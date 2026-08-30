module.exports = function (api) {
  api.cache(true);
  return {
    // SDK 51: babel-preset-expo already wires expo-router + jsx transform;
    // the legacy 'expo-router/babel' plugin must NOT be added here.
    presets: ['babel-preset-expo'],
  };
};
