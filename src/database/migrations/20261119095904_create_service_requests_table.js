exports.up = function (knex) {
  return knex.schema.createTable('service_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('reference', 100).notNullable().unique();
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('booking_id').notNullable()
      .references('id').inTable('bookings').onDelete('RESTRICT');
    table.uuid('assigned_to').nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.enu('category', [
      'housekeeping', 'food_beverage', 'maintenance'
    ]).notNullable();
    table.text('details').notNullable();
    table.integer('quantity').nullable();
    table.enu('priority', [
      'low', 'normal', 'high', 'urgent'
    ]).nullable();
    table.text('notes').nullable();
    table.enu('status', [
      'pending', 'in_progress', 'completed'
    ]).notNullable().defaultTo('pending');
    table.timestamps(true, true);
    table.index(['user_id', 'status']);
    table.index(['assigned_to', 'status']);
  });
};
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('service_requests');
};