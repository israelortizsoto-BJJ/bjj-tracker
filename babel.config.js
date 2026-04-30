module.exports = function (api) {
  api.cache(true);
  return {
    presets: [require.resolve("babel-preset-expo")],
    plugins: [
      [
        require.resolve("babel-plugin-module-resolver"),
        {
          extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
          alias: {
            src: "./src",
          },
        },
      ],
    ],
  };
};
