/**
 * Remotion Configuration File
 *
 * We need to override the Webpack config to support Tailwind CSS v4.
 * Tailwind v4 is purely a PostCSS plugin, so we need to ensure the css-loader
 * and postcss-loader are correctly configured to handle the modern CSS syntax.
 */

import { Config } from '@remotion/cli/config';

Config.overrideWebpackConfig((currentConfiguration) => {
  return {
    ...currentConfiguration,
    module: {
      ...currentConfiguration.module,
      rules: [
        ...(currentConfiguration.module?.rules ?? []).filter((rule) => {
          // Filter out default CSS rules to replace them with our PostCSS-enabled rule
          if (rule && typeof rule === 'object' && rule.test && rule.test.toString().includes('css')) {
            return false;
          }
          return true;
        }),
        {
          test: /\.css$/i,
          use: [
            'style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  config: './postcss.config.mjs',
                },
              },
            }
          ],
        },
      ],
    },
  };
});
