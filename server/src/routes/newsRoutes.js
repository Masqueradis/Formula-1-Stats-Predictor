const router = require('express').Router();
const ctrl = require('../controllers/newsController');

router.get('/', ctrl.getNews);

module.exports = router;