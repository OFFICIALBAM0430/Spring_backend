exports.up = function (knex) {
  return knex.schema.createTable('service_request_histories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('service_request_id').notNullable()
      .references('id').inTable('service_requests').onDelete('CASCADE');
    table.uuid('changed_by').nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.string('previous_status', 30).nullable();
    table.string('new_status', 30).notNullable();
    table.text('note').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['service_request_id', 'created_at']);
  });
};
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('service_request_histories');
};