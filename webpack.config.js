const path = require("path");
const fs = require("fs");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    watch: true,
  entry: {
    background: "./src/background.ts",
    contentScript: "./src/contentScript.ts",
    "popup/popup": "./src/popup/index.tsx",
    "options/options": "./src/options/index.tsx"
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js"
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: "ts-loader"
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        // Always copy manifest.json — we will overwrite it below if manifest.local.json exists
        { from: "public/manifest.json", to: "manifest.json" },

        // Overwrite with local manifest if it exists
        {
          from: "public/manifest.local.json",
          to: "manifest.json",
          noErrorOnMissing: true
        },

        { from: "public/icon16.png", to: "." },
        { from: "public/icon48.png", to: "." },
        { from: "public/icon128.png", to: "." },
        { from: "public/email-radar-icon.png", to: "." },
        { from: "public/email-radar-icon-ni.png", to: "." },
        { from: "public/email-radar-full-logo.png", to: "popup" },

        { from: "public/popup", to: "popup" },
        { from: "public/options", to: "options" }
      ]
    })
  ]
};
