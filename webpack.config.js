const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

module.exports = {
  mode: "development",
  entry: "./src/index.ts",
  devtool: "inline-source-map",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            transpileOnly: true,
            experimentalWatchApi: true,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.wasm$/,
        type: "asset/resource",
      },

      {
        test: /\.worker\.(js|ts)$/,
        use: {
          loader: "worker-loader",
          options: {
            inline: "no-fallback",
          },
        },
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    fallback: {
      fs: false,
      path: false,
      crypto: false,
    },
  },
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
    publicPath: "/",
  },
  devServer: {
    static: [
      {
        directory: path.join(__dirname, "dist"),
        publicPath: "/",
      },
      {
        directory: path.join(__dirname, "assets"),
        publicPath: "/assets",
      },
    ],
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    compress: true,
    port: 8080,
    hot: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      filename: "index.html",
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "assets",
          to: "assets",
        },
        {
          from: path.resolve(
            __dirname,
            "node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js"
          ),
          to: path.resolve(__dirname, "dist/ffmpeg-core.js"),
        },
        {
          from: "assets/favicon.ico",
          to: "favicon.ico",
        },
        {
          from: path.resolve(
            __dirname,
            "node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm"
          ),
          to: path.resolve(__dirname, "dist/ffmpeg-core.wasm"),
        },
      ],
    }),
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
  ],
  experiments: {
    asyncWebAssembly: true,
  },
  ignoreWarnings: [
    {
      module: /@ffmpeg\/ffmpeg/,
      message: /Critical dependency/,
    },
  ],
};
