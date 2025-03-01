import express from 'express';

const router = express.Router();

// Category routes will be implemented here
router.get('/', (req, res) => {
  // Temporary placeholder response
  res.json({ message: 'Get categories endpoint (to be implemented)' });
});

router.get('/:id', (req, res) => {
  // Temporary placeholder response
  res.json({ message: `Get category with ID ${req.params.id} (to be implemented)` });
});

export default router;