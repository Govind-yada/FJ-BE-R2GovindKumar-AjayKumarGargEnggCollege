'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/category.controller');
const { authenticateJWT } = require('../middleware/auth');
const { validate }        = require('../middleware/validate');
const schemas = require('../validators/category.validators');

router.use(authenticateJWT);

router.get('/',       ctrl.getAll);
router.post('/',      validate(schemas.create), ctrl.create);
router.put('/:id',    validate(schemas.update), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
