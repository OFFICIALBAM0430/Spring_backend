exports.up = function (knex) {
  return knex.schema.createTable('rooms', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('room_number', 20).notNullable().unique();
    table.uuid('room_type_id')
      .notNullable()
      .references('id')
      .inTable('room_types')
      .onDelete('RESTRICT');
    table.integer('floor').nullable();
    table.enu('status', [
      'active',
      'maintenance',
      'out_of_service'
    ]).notNullable().defaultTo('active');
    table.text('description').nullable();
    table.timestamps(true, true);
  });
};
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('rooms');
};