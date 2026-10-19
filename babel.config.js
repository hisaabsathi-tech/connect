/** @type {import('@babel/core').ConfigFunction} */
module.exports = (api) => {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "transform-imports",
        {
          // The package root re-exports ~6,000 icons and Metro does not tree-shake, so a named import
          // from it bundles every icon. Rewrite each one to its own file (the package's `./*` export).
          "@hugeicons/core-free-icons": {
            transform: "@hugeicons/core-free-icons/${member}",
            preventFullImport: true,
          },
        },
      ],
    ],
  };
};
