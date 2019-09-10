const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: "development",
  entry: './src/main.js',
  output: {
    filename: 'meshy.js',
    path: path.resolve(__dirname, 'dist'),
    //libraryTarget: 'var',
    library: "meshy",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["babel-preset-env"]
          }
        }
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [
          'file-loader'
       ]
      },
    ]
  },
  resolve: {
  },
  performance: {
  },
 // devtool:
  devServer: {
  },
  plugins: [
    new webpack.ProvidePlugin({
		'THREE': 'three'
	})
  ]
};
