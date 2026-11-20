const knex = require('knex');
const knexConfig = require('../../knexfile');

const environment = process.env.NODE_ENV;

const db = knex(knexConfig[environment]);

const dbJs = async () => {
   try {
      await db.raw('SELECT 1');
      console.log('PostgreSQL connected successfully');
   } catch (error) {
      console.error('Postgres connection failed:', error.message);
      throw error;
   }
};

module.exports = { db, dbJs };