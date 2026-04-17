import chalk from 'chalk';

const CATEGORY_EMOJI = { llm: '🧠', defi: '⛓️', quant: '📊', general: '⚙️' };
const DISPLAY_LIMIT = 10;

function timeAgo(isoString) {
  if (!isoString) return null;
  const mins = Math.floor((Date.now() - new Date(isoString)) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function hostname(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

export function printFeed({ items, personalized, ingested_at }, categories) {
  if (!items || items.length === 0) {
    console.log(chalk.dim('  No results found.'));
    return;
  }

  const label = categories.length
    ? categories.map(c => `${CATEGORY_EMOJI[c] ?? '📌'} ${c.toUpperCase()}`).join('  ')
    : '📡 ALL';

  console.log();
  console.log(chalk.bold(`${label}  ${chalk.dim('─'.repeat(42))}`));
  console.log();

  const shown = items.slice(0, DISPLAY_LIMIT);
  for (const item of shown) {
    console.log(`  ${chalk.white('•')} ${chalk.bold(item.raw_title)}`);
    if (item.summary) {
      console.log(`    ${chalk.dim(item.summary)}`);
    }
    console.log(`    ${chalk.dim(hostname(item.source_url))}`);
    console.log();
  }

  if (items.length > DISPLAY_LIMIT) {
    console.log(chalk.dim(`  + ${items.length - DISPLAY_LIMIT} more`));
    console.log();
  }

  const footer = [
    `${shown.length} item${shown.length !== 1 ? 's' : ''}`,
    personalized ? chalk.green('personalized') : chalk.dim('not personalized'),
    ingested_at ? chalk.dim(timeAgo(ingested_at)) : null,
  ].filter(Boolean).join(chalk.dim(' · '));

  console.log(`  ${chalk.dim('─'.repeat(48))}`);
  console.log(`  ${footer}`);
  console.log();
}
