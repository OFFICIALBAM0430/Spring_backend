exports.up = function (knex) {
  return knex.schema.createTable('payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('booking_id').notNullable()
      .references('id').inTable('bookings').onDelete('RESTRICT');
    table.string('reference', 150).notNullable().unique();
    table.string('gateway').notNullable().defaultTo('paystack');
    table.decimal('amount', 12, 2).notNullable();
    table.string('currency', 3).notNullable().defaultTo('NGN');
    table.enu('status', [
      'initialized', 'pending', 'successful', 'failed', 'abandoned'
    ]).notNullable().defaultTo('initialized');
    table.string('gateway_transaction_id').nullable();
    table.string('channel').nullable();
    table.jsonb('gateway_response').nullable();
    table.timestamp('paid_at', { useTz: true }).nullable();
    table.timestamps(true, true);
    table.index(['booking_id', 'status']);
  });
};
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('payments');
};