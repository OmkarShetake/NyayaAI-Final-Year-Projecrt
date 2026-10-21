const router = require('express').Router();
const ctrl = require('../controllers/caseController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createCaseSchema, updateCaseSchema, listQuerySchema, idParamSchema } = require('../validators/caseValidators');
const { similarBodySchema } = require('../validators/predictionValidators');

router.use(protect);

router
  .route('/')
  .get(validate(listQuerySchema, 'query'), ctrl.list)
  .post(authorize('admin', 'analyst'), validate(createCaseSchema), ctrl.create);

router
  .route('/sync-kanoon/status')
  .get(authorize('admin', 'analyst'), ctrl.getKanoonStatus);

router
  .route('/sync-kanoon')
  .post(authorize('admin', 'analyst'), ctrl.syncKanoon);

router
  .route('/:id')
  .get(validate(idParamSchema, 'params'), ctrl.get)
  .put(authorize('admin', 'analyst'), validate(idParamSchema, 'params'), validate(updateCaseSchema), ctrl.update)
  .delete(authorize('admin', 'analyst'), validate(idParamSchema, 'params'), ctrl.remove);

router
  .route('/:id/similar')
  .get(validate(idParamSchema, 'params'), ctrl.getSimilar)
  .post(authorize('admin', 'analyst'), validate(idParamSchema, 'params'), validate(similarBodySchema), ctrl.findSimilar);

module.exports = router;
