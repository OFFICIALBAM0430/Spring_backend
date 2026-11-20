
exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('verification_token', 255).nullable();
    table.timestamp('verification_expires_at', { useTz: true }).nullable();
    table.string('password_reset_token_hash', 255).nullable();
    table.timestamp('password_reset_expires_at', { useTz: true }).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('verification_token');
    table.dropColumn('verification_expires_at');
    table.dropColumn('password_reset_token_hash');
    table.dropColumn('password_reset_expires_at');
  });
};
