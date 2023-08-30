const properties = require("./json/properties.json");
const users = require("./json/users.json");

const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  database: "lightbnb",
});

// the following assumes that you named your connection variable `pool`
// pool.query(`SELECT title FROM properties LIMIT 10;`).then(response => {console.log(response)})

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function (email) {
  return pool
    .query(
      `
    SELECT * FROM users 
    WHERE email = $1
  `,
      [email]
    )
    .then((result) => {
      return result.rows[0] || null;
    })
    .catch((err) => {
      console.log(err.message);
      throw err;
    });
};

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function (id) {
  return pool
    .query(
      `
    SELECT * FROM users 
    WHERE id = $1
  `,
      [id]
    )
    .then((result) => {
      return result.rows[0] || null;
    })
    .catch((err) => {
      console.log(err.message);
      throw err;
    });
};

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function (user) {
  return pool
    .query(
      `
    INSERT INTO users (name, email, password) 
    VALUES ($1, $2, $3) 
    RETURNING *;
  `,
      [user.name, user.email, user.password]
    )
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
      throw err;
    });
};

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function (guest_id, limit = 10) {
  return pool
    .query(
      `
    SELECT properties.*, reservations.*, AVG(property_reviews.rating) as average_rating
    FROM reservations
    JOIN properties ON reservations.property_id = properties.id
    JOIN property_reviews ON properties.id = property_reviews.property_id
    WHERE reservations.guest_id = $1
    AND reservations.end_date < now()::date
    GROUP BY properties.id, reservations.id
    ORDER BY reservations.start_date DESC
    LIMIT $2;
  `,
      [guest_id, limit]
    )
    .then((res) => res.rows)
    .catch((err) => {
      console.error("query error", err.stack);
    });
};

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function (options, limit = 10) {
  const queryParams = [];
  let queryString = `
    SELECT properties.*, avg(property_reviews.rating) as average_rating
    FROM properties
    LEFT JOIN property_reviews ON properties.id = property_id
  `;

  // Set up an array to hold our multiple WHERE conditions
  const whereClauses = [];

  if (options.city) {
    queryParams.push(`%${options.city}%`);
    whereClauses.push(`city LIKE $${queryParams.length}`);
  }

  if (options.owner_id) {
    queryParams.push(options.owner_id);
    whereClauses.push(`owner_id = $${queryParams.length}`);
  }

  if (options.minimum_price_per_night) {
    queryParams.push(options.minimum_price_per_night * 100); // Convert to cents
    whereClauses.push(`cost_per_night >= $${queryParams.length}`);
  }

  if (options.maximum_price_per_night) {
    queryParams.push(options.maximum_price_per_night * 100); // Convert to cents
    whereClauses.push(`cost_per_night <= $${queryParams.length}`);
  }

  if (whereClauses.length) {
    queryString += "WHERE " + whereClauses.join(" AND ");
  }

  queryString += `
    GROUP BY properties.id
  `;

  if (options.minimum_rating) {
    queryParams.push(options.minimum_rating);
    queryString += `HAVING avg(property_reviews.rating) >= $${queryParams.length}`;
  }

  queryParams.push(limit);
  queryString += `
    ORDER BY cost_per_night
    LIMIT $${queryParams.length};
  `;

  console.log(queryString, queryParams);

  return pool.query(queryString, queryParams).then((res) => res.rows);
};

/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function (property) {
  const addProperty = function (property) {
    // Ensure integer fields have valid values or default to 0
    property.cost_per_night = property.cost_per_night
      ? parseInt(property.cost_per_night * 100)
      : 0;
    property.parking_spaces = property.parking_spaces
      ? parseInt(property.parking_spaces)
      : 0;
    property.number_of_bathrooms = property.number_of_bathrooms
      ? parseInt(property.number_of_bathrooms)
      : 0;
    property.number_of_bedrooms = property.number_of_bedrooms
      ? parseInt(property.number_of_bedrooms)
      : 0;

    return pool
      .query
      // ... [same INSERT statement as before]
      ()
      .then((res) => res.rows[0])
      .catch((err) => {
        console.log(err.message);
      });
  };

  return pool
    .query(
      `
      INSERT INTO properties (
        owner_id,
        title,
        description,
        thumbnail_photo_url,
        cover_photo_url,
        cost_per_night,
        street,
        city,
        province,
        post_code,
        country,
        parking_spaces,
        number_of_bathrooms,
        number_of_bedrooms
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
      `,
      [
        property.owner_id,
        property.title,
        property.description,
        property.thumbnail_photo_url,
        property.cover_photo_url,
        parseInt(property.cost_per_night * 100), // Assuming cost_per_night is in dollars and we need to store in cents
        property.street,
        property.city,
        property.province,
        property.post_code,
        property.country,
        property.parking_spaces,
        property.number_of_bathrooms,
        property.number_of_bedrooms,
      ]
    )
    .then((res) => res.rows[0])
    .catch((err) => {
      console.log(err.message);
    });
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
