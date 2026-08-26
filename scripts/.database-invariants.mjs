import assert from 'node:assert/strict';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const checks = [
  ['negative item stock', sql`SELECT count(*)::int AS n FROM items WHERE current_stock < 0`, 0],
  ['negative item minimum', sql`SELECT count(*)::int AS n FROM items WHERE min_stock < 0`, 0],
  ['negative equipment quantity', sql`SELECT count(*)::int AS n FROM equipment WHERE quantity < 0`, 0],
  ['invalid batch balances', sql`SELECT count(*)::int AS n FROM inventory_batches WHERE remaining_quantity < 0 OR remaining_quantity > received_quantity`, 0],
  ['negative custody outstanding', sql`SELECT count(*)::int AS n FROM personal_custodies WHERE returned_quantity < 0 OR returned_quantity > quantity`, 0],
  ['negative transaction quantities', sql`SELECT count(*)::int AS n FROM transactions WHERE quantity IS NOT NULL AND quantity <= 0`, 0],
  ['duplicate serial equipment', sql`SELECT count(*)::int AS n FROM (SELECT serial_number FROM equipment WHERE serial_number IS NOT NULL GROUP BY serial_number HAVING count(*) > 1) duplicates`, 0],
  ['open custody with negative outstanding', sql`SELECT count(*)::int AS n FROM personal_custodies WHERE status IN ('open','partially_returned','damaged') AND quantity <= returned_quantity`, 0],
];
for (const [name, query, expected] of checks) {
  const [row] = await query;
  const n = Number(row.n);
  assert.equal(n, expected, `${name}: ${n}`);
  console.log(`PASS ${name}: ${n}`);
}
const [counts] = await sql`
  SELECT
    (SELECT count(*) FROM users WHERE is_active) AS active_users,
    (SELECT count(*) FROM items WHERE is_active) AS active_items,
    (SELECT count(*) FROM equipment) AS equipment,
    (SELECT count(*) FROM transactions) AS transactions,
    (SELECT count(*) FROM inventory_batches) AS batches,
    (SELECT count(*) FROM personal_custodies) AS custodies
`;
console.log('Dataset counts', JSON.stringify(counts));
await sql.end();
