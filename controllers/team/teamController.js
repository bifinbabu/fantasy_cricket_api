const {
  validatePlayerEntries,
  validateTeamDetails,
  validateTeamCriteria,
  createTeamService,
  calculatePoints,
  storeMatchResultService,
  teamResultService,
  hello,
} = require("../../services/team/teamService");

const addTeamController = async (req, res) => {
  console.log("req new", req.body);
  const { teamName, players, captain, viceCaptain } = req.body;
  if (!teamName || !captain || !viceCaptain) {
    res.status(503).json({
      message: "Team name, captain name and vice-captain name are mandatory",
    });
  } else {
    const playerValidationResult = await validatePlayerEntries(players);
    if (!playerValidationResult) {
      res.status(503).json({ message: "11 players are mandatory" });
    } else {
      const result = await validateTeamDetails(
        teamName,
        captain,
        viceCaptain,
        players
      );
      if (!result) {
        res.status(503).json({
          message: "Provide valid captain and vice captain",
        });
      } else {
        const result = await validateTeamCriteria(players);
        console.log("validateTeamCriteria", result);
        if (!result) {
          res.status(503).json({
            message:
              "Team must consists of Wicket Keeper, Batter, All Rounder, Bowler where minimum value is 1 and maximum is 8 for each player type",
          });
        } else {
          const newtTeam = await createTeamService(
            teamName,
            players,
            captain,
            viceCaptain
          );
          if (!newtTeam) {
            res.status(500).json({
              message: "Internal server error",
            });
          } else {
            res.status(200).json({ message: "Success" });
          }
        }
      }
    }
  }
};

// ----------------------------------------------------------------------

const processResultController = async (req, res) => {
  const result = await calculatePoints();
  if (result) {
    const matchName = "CSKvRR";
    const newMatchResult = await storeMatchResultService(matchName, result);
    if (newMatchResult) {
      res.status(200).json({ result });
    } else {
      res.status(500).json({ message: "Internal server error" });
    }
  } else {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ----------------------------------------------------------------------

const teamResultController = async (req, res) => {
  const matchName = "CSKvRR";
  const result = await teamResultService(matchName);
  if (result) {
    res.status(200).json({ result });
  } else {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ----------------------------------------------------------------------

module.exports = {
  addTeamController,
  processResultController,
  teamResultController,
};
