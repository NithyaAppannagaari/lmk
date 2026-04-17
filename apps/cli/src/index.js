#!/usr/bin/env node

import readline from 'readline';
import { program } from 'commander';
import ora from 'ora';
import config from './config.js';
import { register, fetchFeed, storePreference, whoami } from './api.js';
import { printFeed } from './format.js';

// ── Auth subcommand ───────────────────────────────────

const auth = program.command('auth');

auth
  .command('login')
  .description('Authenticate with your email to get an API key')
  .action(async () => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const email = await new Promise(resolve =>
      rl.question('Email: ', ans => { rl.close(); resolve(ans.trim()); })
    );

    if (!email) { console.error('Email required.'); process.exit(1); }

    const spinner = ora('Authenticating...').start();
    try {
      const apiKey = await register(email);
      config.set('apiKey', apiKey);
      config.set('email', email);
      spinner.succeed(`Authenticated as ${email}`);
      console.log(`\n  Run ${chalk_bold('lmk')} to get started.\n`);
    } catch (err) {
      spinner.fail('Authentication failed');
      console.error(err.message);
      process.exit(1);
    }
  });

auth
  .command('logout')
  .description('Clear local credentials')
  .action(() => {
    config.delete('apiKey');
    config.delete('email');
    console.log('\n  Logged out.\n');
  });

auth
  .command('whoami')
  .description('Show the currently authenticated email')
  .action(async () => {
    const stored = config.get('email');
    if (stored) { console.log(`\n  ${stored}\n`); return; }

    const apiKey = config.get('apiKey');
    if (!apiKey) { console.error('\n  Not authenticated. Run: lmk auth login\n'); process.exit(1); }

    try {
      const email = await whoami();
      config.set('email', email);
      console.log(`\n  ${email}\n`);
    } catch {
      console.error('\n  Not authenticated. Run: lmk auth login\n');
      process.exit(1);
    }
  });

function chalk_bold(s) { return `\x1b[1m${s}\x1b[0m`; }

// ── Main command ──────────────────────────────────────

program
  .name('lmk')
  .description('Personalized developer news')
  .version('0.1.0')
  .option('--llm', 'LLM and AI ecosystem')
  .option('--defi', 'DeFi and on-chain finance')
  .option('--quant', 'Prediction markets, algo trading, quant research')
  .option('--general', 'Developer tooling, OSS, infra')
  .option('--chat', 'Tell lmk what you want to learn (updates personalization)')
  .action(async (options) => {
    if (!config.get('apiKey')) {
      console.error('\n  Not authenticated. Run: lmk auth login\n');
      process.exit(1);
    }

    // --chat: one-shot preference capture
    if (options.chat) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const text = await new Promise(resolve =>
        rl.question('\nWhat do you want to learn about?\n> ', ans => { rl.close(); resolve(ans.trim()); })
      );
      if (!text) { console.log('Nothing saved.'); return; }

      const spinner = ora('Saving preferences...').start();
      try {
        await storePreference(text);
        spinner.succeed('Got it. Your next lmk run will reflect this.\n');
      } catch (err) {
        spinner.fail('Failed to save preferences');
        console.error(err.message);
        process.exit(1);
      }
      return;
    }

    // News feed
    const categories = ['llm', 'defi', 'quant', 'general'].filter(c => options[c]);
    const label = categories.length ? categories.map(c => c.toUpperCase()).join('+') : 'ALL';

    const spinner = ora(`Fetching ${label}...`).start();
    try {
      const data = await fetchFeed(categories);
      spinner.stop();
      printFeed(data, categories);
    } catch (err) {
      spinner.fail('Failed to fetch feed');
      if (err.response?.status === 401) {
        console.error('  Not authenticated. Run: lmk auth login');
      } else {
        console.error(err.message);
      }
      process.exit(1);
    }
  });

program.parse();
