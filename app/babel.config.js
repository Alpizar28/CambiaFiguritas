// Reemplaza `import.meta` por `({})` para que zustand/middleware no rompa
// en Metro web dev (Metro no transforma esa sintaxis ESM/Vite).
// La build de producción además aplica un post-patch en scripts/patch-web-bundle.js
// como red de seguridad.
function transformImportMeta() {
  return {
    visitor: {
      MetaProperty(path) {
        const { meta, property } = path.node;
        if (meta && meta.name === 'import' && property && property.name === 'meta') {
          path.replaceWithSourceString('({})');
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [transformImportMeta],
  };
};
