const express = require('express');
const router = express.Router();
const groceryController = require('./grocerycontroller');

router.get('/stats', groceryController.getStats);
router.get('/', groceryController.getAllItems);
router.get('/:id', groceryController.getItemById);
router.post('/', groceryController.addItem);
router.put('/:id', groceryController.updateItem);
router.delete('/:id', groceryController.deleteItem);

module.exports = router;