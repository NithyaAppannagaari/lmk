#!/usr/bin/env node

import { program } from 'commander';
import ora from 'ora';
import { fetchInsights } from './api.js';
import { printInsights } from './format.js';

program
  .name('lmk')
  .description('Developer intelligence & action system')
  .version('0.1.0');

program
  .option('--llm', 'LLM and AI ecosystem updates')
  .option('--defi', 'DeFi ecosystem updates')
  .option('--quant', 'Prediction markets and quant updates')
  .option('--general', 'General engineering updates')
  .action(async (options) => {
    const categories = ['llm', 'defi', 'quant', 'general'].filter(c => options[c]);

    // if no flags, fetch everything
    if (categories.length === 0) {
      const spinner = ora('Fetching intelligence...').start();
      try {
        const insights = await fetchInsights();
        spinner.stop();
        printInsights(insights, null);
      } catch (err) {
        spinner.fail('Failed to fetch insights');
        console.error(err.message);
      }
      return;
    }

    // fetch per category
    for (const category of categories) {
      const spinner = ora(`Fetching ${category.toUpperCase()} insights...`).start();
      try {
        const insights = await fetchInsights(category);
        spinner.stop();
        printInsights(insights, category);
      } catch (err) {
        spinner.fail(`Failed to fetch ${category} insights`);
        console.error(err.message);
      }
    }
  });

program.parse();