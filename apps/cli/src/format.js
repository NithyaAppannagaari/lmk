import chalk from 'chalk';

const CATEGORY_EMOJI = {
  llm: '🧠',
  defi: '⛓️',
  quant: '📊',
  general: '⚙️',
};

export function printInsights(insights, category = null) {
  if (insights.length === 0) {
    const label = category ? category.toUpperCase() : 'this category';
    console.log(`  No insights found for ${label}.\n`);
    return;
  }

  for (const insight of insights) {
    const emoji = CATEGORY_EMOJI[insight.categories?.[0]] ?? '📌';
    console.log(`${emoji}  ${chalk.bold(insight.raw_title)}`);
    console.log(`    → ${insight.summary}`);
    console.log(`    ${chalk.dim(insight.source_url)}`);
    console.log();
  }
}