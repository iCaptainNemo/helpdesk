const { body, validationResult } = require('express-validator');

const sanitizeInput = [
  // Validate and sanitize the adObjectID field
  body('adObjectID')
    .optional()
    .trim()
    .isLength({ min: 1 }).withMessage('AD Object ID is required')
    .isAlphanumeric().withMessage('AD Object ID must be alphanumeric')
    .escape(),

  // Validate and sanitize the ServerName field
  body('ServerName')
    .trim()
    .isLength({ min: 1 }).withMessage('Server Name is required')
    .isAlphanumeric().withMessage('Server Name must be alphanumeric')
    .escape(),

  // Validate and sanitize the Description field
  body('Description')
    .optional()
    .trim()
    .escape(),

  // Validate and sanitize the Location field
  body('Location')
    .optional()
    .trim()
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