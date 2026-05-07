const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// zustand esm/middleware.mjs uses import.meta.env which Metro/Hermes cannot parse.
// On web, redirect zustand middleware imports to the CJS build (no import.meta).
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (
      platform === 'web' &&
      (moduleName === 'zustand/middleware' || moduleName.endsWith('/zustand/middleware'))
    ) {
      return {
        filePath: require.resolve('zustand/middleware'),
        type: 'sourceFile',
      };
    }
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
