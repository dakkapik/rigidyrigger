const express = require('express');
const router = express.Router();
const path = require("path")

router.get('/', (req, res) => {
  let pathString = path.join(__dirname,'../addons','moCap.html')
  console.log(pathString)
  res.sendFile(pathString)
})

module.exports = router;
