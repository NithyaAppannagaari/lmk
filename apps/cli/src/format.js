import chalk from 'chalk';

const CATEGORY_EMOJI = {
  llm: '🧠',
  defi: '⛓️',
  quant: '📊',
  general: '⚙️',
};

const DISPLAY_LIMIT = 5;

function printDigest(digest, category) {
  const label = category ? category.toUpperCase() : 'TODAY';
  console.log(chalk.bold(`── ${label} DIGEST ──────────────────────────`));
  console.log(digest);
  console.log();
}

export function printInsights(insights, category = null, digest = null) {
  if (!insights || insights.length === 0) {
    const label = category ? category.toUpperCase() : 'this category';
    console.log(`  No insights found for ${label}.\n`);
    return;
  }

  if (digest) {
    printDigest(digest, category);
  }

  const displayed = insights.slice(0, DISPLAY_LIMIT);
  for (const insight of displayed) {
    const emoji = CATEGORY_EMOJI[insight.categories?.[0]] ?? '📌';
    console.log(`${emoji}  ${chalk.bold(insight.raw_title)}`);
    console.log(`    → ${insight.summary}`);
    console.log(`    ${chalk.dim(insight.source_url)}`);
    console.log();
  }

  if (insights.length > DISPLAY_LIMIT) {
    console.log(chalk.dim(`  + ${insights.length - DISPLAY_LIMIT} more — run with a category flag to filter`));
    console.log();
  }
}