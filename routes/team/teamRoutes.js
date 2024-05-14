const express = require("express");
const {
  addTeamController,
  processResultController,
  teamResultController,
} = require("../../controllers/team/teamController");
const router = express.Router();

router.post("/add-team", addTeamController);
router.get("/process-result", processResultController);
router.get("/team-result", teamResultController);

module.exports = router;
