#!/usr/bin/env node

import { program } from 'commander';
import ora from 'ora';
import { fetchInsights, fetchDigest } from './api.js';
import { printInsights } from './format.js';

program
  .name('lmk')
  .description('Developer intelligence & action system')
  .version('0.1.0');

program
  .option('--llm', 'LLM and AI ecosystem updates')
  .option('--defi', 'DeFi ecosystem updates')
  .option('--quant', 'Prediction markets (Polymarket, Kalshi), algo trading, market microstructure, quant research & infra, hedge fund activity — NOT general crypto/DeFi')
  .option('--general', 'General engineering updates')
  .action(async (options) => {
    const categories = ['llm', 'defi', 'quant', 'general'].filter(c => options[c]);

    const label = categories.length > 0 ? categories.map(c => c.toUpperCase()).join(' + ') : 'ALL';
    const spinner = ora(`Fetching ${label} insights...`).start();
    try {
      // fetch items for each selected category (or all if no flags)
      let items;
      if (categories.length === 0) {
        items = await fetchInsights();
      } else {
        const results = await Promise.all(categories.map(c => fetchInsights(c)));
        // combine and dedupe by source_url
        const seen = new Set();
        items = results.flat().filter(item => {
          if (seen.has(item.source_url)) return false;
          seen.add(item.source_url);
          return true;
        });
        items.sort((a, b) => b.signal_score - a.signal_score);
      }

      // generate one digest from all collected summaries
      const summaries = items.map(i => i.summary).filter(Boolean);
      const digest = summaries.length > 0 ? await fetchDigest(summaries) : null;

      spinner.stop();
      printInsights(items, categories.length === 1 ? categories[0] : null, digest);
    } catch (err) {
      spinner.fail('Failed to fetch insights');
      console.error(err.message);
    }
  });

program.parse();