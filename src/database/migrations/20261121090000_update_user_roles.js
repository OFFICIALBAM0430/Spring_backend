
exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropChecks(['users_role_check']);
  });

  await knex.raw(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (
      role IN (
        'guest',
        'receptionist',
        'administrator',
        'service_staff'
      )
    )
  `);


  await knex('users')
    .where('role', 'staff')
    .update({ role: 'service_staff' });

  await knex('users')
    .where('role', 'admin')
    .update({ role: 'administrator' });
};

exports.down = async function (knex) {

  await knex('users')
    .where('role', 'service_staff')
    .update({ role: 'staff' });

  await knex('users')
    .where('role', 'administrator')
    .update({ role: 'admin' });

  await knex.schema.alterTable('users', (table) => {
    table.dropChecks(['users_role_check']);
  });

  await knex.raw(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('guest', 'staff', 'admin'))
  `);
};
  
