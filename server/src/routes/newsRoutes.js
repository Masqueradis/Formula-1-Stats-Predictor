const router = require('express').Router();
const ctrl = require('../controllers/newsController');

router.get('/', ctrl.getNews);
router.get('/archive', ctrl.getArchive);

module.exports = router;
