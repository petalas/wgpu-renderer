const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const devMode = process.env.NODE_ENV !== "production";

module.exports = {
  mode: devMode ? "development" : "production",
  entry: "./src/index.js",
  devtool: "source-map",
  devServer: {
    static: {
      directory: path.resolve(__dirname, "dist"),
    },
    hot: true,
    open: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: "Renderer Test",
      template: path.resolve(__dirname, "src/index.html"),
    }),
  ],
  output: {
    filename: "[name].[contenthash].js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
};
