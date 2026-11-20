
exports.seed = async function (knex) {
  await knex('room_rates').del();
  await knex('rooms').del();
  await knex('room_categories').del();
  await knex('additional_charges').del();
  await knex('platform_settings').del();

  const categoryRows = await knex('room_categories')
    .insert([
      { name: 'Single Deluxe', capacity: 2, is_active: true },
      { name: 'Super Deluxe', capacity: 4, is_active: true },
      { name: 'Presidential', capacity: 6, is_active: true },
    ])
    .returning(['id', 'name']);

  const categoryIds = Object.fromEntries(
    categoryRows.map((row) => [row.name, row.id]),
  );

  const rooms = [];

  for (let number = 1; number <= 12; number += 1) {
    rooms.push({
      identifier: `SD-${String(number).padStart(3, '0')}`,
      category_id: categoryIds['Single Deluxe'],
      status: 'ready',
    });
  }

  for (let number = 1; number <= 5; number += 1) {
    rooms.push({
      identifier: `SU-${String(number).padStart(3, '0')}`,
      category_id: categoryIds['Super Deluxe'],
      status: 'ready',
    });
  }

  for (let number = 1; number <= 3; number += 1) {
    rooms.push({
      identifier: `PR-${String(number).padStart(3, '0')}`,
      category_id: categoryIds['Presidential'],
      status: 'ready',
    });
  }

  await knex('rooms').insert(rooms);

  await knex('room_rates').insert([
    {
      category_id: categoryIds['Single Deluxe'],
      amount_per_night: 90000,
      currency: 'NGN',
      effective_from: '2026-01-01',
      is_active: true,
    },
    {
      category_id: categoryIds['Super Deluxe'],
      amount_per_night: 120000,
      currency: 'NGN',
      effective_from: '2026-01-01',
      is_active: true,
    },
    {
      category_id: categoryIds['Presidential'],
      amount_per_night: 180000,
      currency: 'NGN',
      effective_from: '2026-01-01',
      is_active: true,
    },
  ]);

  await knex('platform_settings').insert([
    { key: 'check_in_time', value: '09:00', value_type: 'time', description: 'Official check-in time' },
    { key: 'check_out_time', value: '12:00', value_type: 'time', description: 'Official check-out time' },
    { key: 'room_preparation_minutes', value: '120', value_type: 'integer', description: 'Room preparation period pending operational confirmation' },
    { key: 'booking_hold_minutes', value: '30', value_type: 'integer', description: 'Temporary hold period pending hotel confirmation' },
    { key: 'daily_advance_hours', value: '48', value_type: 'integer', description: 'Daily advance rule outside peak periods' },
    { key: 'weekly_monthly_peak_advance_days', value: '30', value_type: 'integer', description: 'Weekly/monthly advance rule during peak periods' },
  ]);

  await knex('additional_charges').insert({
    code: 'VAT',
    name: 'Value Added Tax',
    amount: 0,
    percentage: 7.5,
    currency: 'NGN',
    is_tax: true,
    is_active: false,
  });
};
