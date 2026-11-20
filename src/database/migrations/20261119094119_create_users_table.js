exports.up = function (knex) {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.string('email', 255).notNullable().unique();
    table.string('phone_number', 20).unique();
    table.string('password_hash', 255).notNullable();
    table.enu('role', ['guest', 'staff', 'admin'])
      .notNullable()
      .defaultTo('guest');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('email_verified_at', { useTz: true }).nullable();
    table.timestamps(true, true);
  });
};
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('users');
};