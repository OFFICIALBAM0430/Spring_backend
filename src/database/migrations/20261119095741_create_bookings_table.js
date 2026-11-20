exports.up = function (knex) {
  return knex.schema.createTable('bookings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('booking_reference', 100).notNullable().unique();
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('room_type_id').notNullable()
      .references('id').inTable('room_types').onDelete('RESTRICT');
    table.uuid('room_id').nullable()
      .references('id').inTable('rooms').onDelete('RESTRICT');
    table.date('check_in_date').notNullable();
    table.date('check_out_date').notNullable();
    table.integer('number_of_guests').notNullable().defaultTo(1);
    table.decimal('total_amount', 12, 2).notNullable();
    table.enu('status', [
      'pending', 'confirmed', 'cancelled', 'expired', 'completed'
    ]).notNullable().defaultTo('pending');
    table.timestamp('hold_expires_at', { useTz: true }).nullable();
    table.timestamps(true, true);
    table.check('"check_out_date" > "check_in_date"');
    table.check('"number_of_guests" > 0');
    table.index(['user_id', 'status']);
    table.index(['room_type_id', 'check_in_date', 'check_out_date']);
  });
};
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('bookings');
};