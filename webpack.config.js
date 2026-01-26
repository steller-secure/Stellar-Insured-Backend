const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = function (options, webpack) {
  return {
    ...options,

    entry: options.entry,

    // Performance optimizations
    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
      buildDependencies: {
        config: [__filename],
      },
    },

    // Faster source maps for development
    devtool: options.mode === 'development'
      ? 'eval-cheap-module-source-map'
      : 'source-map',

    // Optimize module resolution
    resolve: {
      ...options.resolve,
      extensions: ['.ts', '.js', '.json'],
      cache: true,
    },

    // Externalize node_modules
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],

    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                experimentalWatchApi: true,
                happyPackMode: true,
              },
            },
          ],
          exclude: /node_modules/,
        },
      ],
    },

    // Optimization settings
    optimization: {
      minimize: options.mode === 'production',
      removeEmptyChunks: true,
      mergeDuplicateChunks: true,
    },

    plugins: [
      ...options.plugins,
    ],

    // Performance hints
    performance: {
      hints: false,
    },

    // Faster file watching
    watchOptions: {
      poll: false,
      ignored: /node_modules/,
      aggregateTimeout: 300,
    },

    // Output configuration
    output: {
      ...options.output,
      pathinfo: false,
    },

    // Stat options for cleaner output
    stats: 'errors-warnings',
  };
};