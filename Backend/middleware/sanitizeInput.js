const { body, validationResult } = require('express-validator');

const sanitizeInput = [
  // Validate and sanitize the adObjectID field
  body('adObjectID')
    .trim()
    .isLength({ min: 1 }).withMessage('AD Object ID is required')
    .isAlphanumeric().withMessage('AD Object ID must be alphanumeric')
    .escape(),

  // Middleware to handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = sanitizeInput;