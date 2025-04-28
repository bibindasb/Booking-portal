// middlewares/errorHandler.js
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation Error',
      details: err.message 
    });
  }
  
  res.status(500).json({ 
    error: 'Something went wrong',
    message: err.message 
  });
}

module.exports = errorHandler;