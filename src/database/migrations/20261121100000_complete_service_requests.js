exports.up = async function (knex) {
  await knex.raw('ALTER TABLE service_requests ALTER COLUMN booking_id DROP NOT NULL');

  await knex.raw('ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check');
  await knex.raw('ALTER TABLE service_requests ALTER COLUMN status TYPE varchar(30) USING status::text');
  await knex.raw(`
    ALTER TABLE service_requests
    ADD CONSTRAINT service_requests_status_check
    CHECK (status IN ('pending', 'acknowledged', 'assigned', 'in_progress', 'completed', 'cancelled'))
  `);

  await knex.schema.alterTable('service_requests', (table) => {
    table.timestamp('acknowledged_at', { useTz: true }).nullable();
    table.timestamp('completed_at', { useTz: true }).nullable();
  });
};

exports.down = async function (knex) {
  // Refuse to discard newer states silently during rollback.
  const newerStates = await knex('service_requests')
    .whereIn('status', ['acknowledged', 'assigned', 'cancelled'])
    .count('* as total').first();
  if (Number(newerStates.total) > 0) {
    throw new Error('Cannot roll back service-request status support while acknowledged, assigned, or cancelled requests exist.');
  }

  await knex.schema.alterTable('service_requests', (table) => {
    table.dropColumn('acknowledged_at');
    table.dropColumn('completed_at');
  });
  await knex.raw('ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check');
  await knex.raw(`
    ALTER TABLE service_requests
    ADD CONSTRAINT service_requests_status_check
    CHECK (status IN ('pending', 'in_progress', 'completed'))
  `);
  await knex.raw('ALTER TABLE service_requests ALTER COLUMN booking_id SET NOT NULL');
};
