const express = require('express');
const router = express.Router();
const path = require("path")

router.get('/', (req, res) => {
  let pathString = path.join(__dirname,'../public','moCap.html')
  res.sendFile(pathString)
})

router.get('/post', (req, res) => {
    let pathString = path.join(__dirname,'../public','postView.html')
    res.sendFile(pathString)
})
  

module.exports = router;
