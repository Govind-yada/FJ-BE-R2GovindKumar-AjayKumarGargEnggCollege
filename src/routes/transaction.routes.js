'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/transaction.controller');
const { authenticateJWT } = require('../middleware/auth');
const { validate }        = require('../middleware/validate');
const { upload }          = require('../middleware/upload');
const schemas = require('../validators/transaction.validators');

router.use(authenticateJWT);

router.get('/',     ctrl.getAll);
router.get('/:id',  ctrl.getById);
router.post('/',    upload.single('receipt'), validate(schemas.create), ctrl.create);
router.put('/:id',  upload.single('receipt'), validate(schemas.update), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
