const fs = require("fs");
const util = require("util");
const path = require("path");
const {
  DB_COLLECTION_NAME,
  getDb,
  DB_MATCH_COLLECTION_NAME,
} = require("../../database");
const readFile = util.promisify(fs.readFile);

// -------------------------------------------------------------------------------

const getPlayers = async () => {
  const data = await readFile(
    path.join(__dirname, "..", "..", "data", "players.json"),
    "utf8"
  );
  const players = JSON.parse(data);
  return players;
};

// -------------------------------------------------------------------------------

const getMatchDetails = async () => {
  const data = await readFile(
    path.join(__dirname, "..", "..", "data", "match.json"),
    "utf8"
  );
  const match = JSON.parse(data);
  return match;
};

// -------------------------------------------------------------------------------

const isPlayerInList = async (name, addedPlayers) => {
  const players = await getPlayers();
  console.log("name", name);
  return (
    players.some((player) => player.Player === name) &&
    addedPlayers.includes(name)
  );
};

const validateTeamDetails = async (teamName, captain, viceCaptain, players) => {
  if (!teamName) return false;
  if (captain === viceCaptain) return false;
  const isCaptainAvailable = await isPlayerInList(captain, players);
  const isViceCaptainAvailable = await isPlayerInList(viceCaptain, players);
  if (!isCaptainAvailable || !isViceCaptainAvailable) {
    return false;
  } else {
  }
  return true;
};

// -------------------------------------------------------------------------------

const hasNoRepetitions = (array) => {
  const uniqueSet = new Set(array);
  return uniqueSet.size === array.length;
};

const checkPlayerAvailability = (allPlayers, players) => {
  const playerNames = new Set(allPlayers.map((player) => player.Player));

  return players.every((name) => playerNames.has(name));
};

const validatePlayerEntries = async (players) => {
  if (!players || players.length !== 11) {
    return false;
  } else {
    const isNamesNotRepeated = hasNoRepetitions(players);
    if (!isNamesNotRepeated) {
      return false;
    }
    const allPlayers = await getPlayers();
    const isAllPlayersAvailable = checkPlayerAvailability(allPlayers, players);
    if (!isAllPlayersAvailable) return false;

    console.log(">>> isAllPlayersAvailable", isAllPlayersAvailable);
  }
  return true;
};

// -------------------------------------------------------------------------------

const validateTeamCriteria = async (playerNames) => {
  const roleCounts = {
    WICKETKEEPER: 0,
    BATTER: 0,
    "ALL-ROUNDER": 0,
    BOWLER: 0,
  };

  const players = await getPlayers();
  // Filter out players that are not in the name array
  const filteredPlayers = players.filter((player) =>
    playerNames.includes(player.Player)
  );

  // Count the number of players for each role in the filtered list
  filteredPlayers.forEach((player) => {
    if (roleCounts.hasOwnProperty(player.Role)) {
      roleCounts[player.Role] += 1;
    }
  });

  // Check if each role has at least 1 and at most 8 players in the filtered list
  return Object.values(roleCounts).every((count) => count >= 1 && count <= 8);
};

// -------------------------------------------------------------------------------

const createTeamService = async (teamName, players, captain, viceCaptain) => {
  try {
    const db = getDb();
    if (!db) {
      console.error("Database connection not available.");
      return false;
    }

    const newPlayerTeam = {
      teamName,
      players,
      captain,
      viceCaptain,
    };

    const newTeam = await db
      .collection(DB_COLLECTION_NAME)
      .insertOne(newPlayerTeam);
    console.log("Added! New Team ID:", newTeam.insertedId);
    return true;
  } catch (error) {
    console.error("Failed to add new team:", error);
    return false;
  }
};

// -------------------------------------------------------------------------------

const calculatePoints = async () => {
  try {
    const playerRoles = await getPlayers();
    const deliveries = await getMatchDetails();

    const getPlayerRole = (playerName) => {
      const player = playerRoles.find((p) => p.Player === playerName);
      return player ? player.Role : undefined;
    };

    let pointsTable = {};

    // temporary
    let overRuns = {};
    let currentOver = -1;

    deliveries.forEach((delivery) => {
      const {
        batter,
        bowler,
        non_striker,
        isWicketDelivery,
        kind,
        batsman_run,
        fielders_involved,
      } = delivery;

      // Ensure all involved players are initialized in the points table
      [batter, bowler, non_striker, fielders_involved].forEach((player) => {
        if (player && !pointsTable[player]) {
          pointsTable[player] = {
            playerRole: getPlayerRole(player),
            runs: 0,
            wickets: 0,
            maidens: 0,
            catches: 0,
            points: 0,
          };
        }
      });

      if (batsman_run > 0) {
        pointsTable[batter].runs += batsman_run;
        pointsTable[batter].points += batsman_run; // 1 point per run
        if (batsman_run === 4) pointsTable[batter].points += 1; // Boundary bonus
        if (batsman_run === 6) pointsTable[batter].points += 2; // Six bonus
      } else if (isWicketDelivery) {
        // Mark player as out if this is a wicket delivery
        pointsTable[batter].out = true;
      }

      // Track over and maiden calculations
      if (delivery.overs !== currentOver) {
        Object.keys(overRuns).forEach((bowlerName) => {
          if (overRuns[bowlerName] === 0) {
            pointsTable[bowlerName].maidens += 1;
            pointsTable[bowlerName].points += 12; // Maiden over bonus
          }
        });
        overRuns = {};
        currentOver = delivery.overs;
      }

      // Handle wickets
      if (isWicketDelivery && kind !== "run out") {
        pointsTable[bowler].wickets += 1;
        pointsTable[bowler].points += 25; // Wicket points
        if (kind === "bowled" || kind === "lbw")
          pointsTable[bowler].points += 8; // Special wicket bonus
      }

      // Deduct points for duck
      Object.entries(pointsTable).forEach(([playerName, stats]) => {
        if (stats.out && stats.runs === 0) {
          const role = getPlayerRole(playerName);
          if (["Batter", "Wicket-Keeper", "All-Rounder"].includes(role)) {
            stats.points -= 2;
          }
        }
      });

      // Handle catches
      if (kind === "caught" && fielders_involved) {
        pointsTable[fielders_involved].catches += 1;
        pointsTable[fielders_involved].points += 8; // Catch points
      }

      // Handle caught and bowled
      if (kind === "caught and bowled") {
        pointsTable[bowler].catches += 1;
        pointsTable[bowler].points += 8; // Catch points
      }
    });

    // Calculate additional bonuses for runs and wickets
    Object.values(pointsTable).forEach((player) => {
      if (player.runs >= 100) {
        player.points += 16;
      } else if (player.runs >= 50) {
        player.points += 8;
      } else if (player.runs >= 30) {
        player.points += 4;
      }

      if (player.wickets >= 5) {
        player.points += 16;
      } else if (player.wickets >= 4) {
        player.points += 8;
      } else if (player.wickets >= 3) {
        player.points += 4;
      }
    });

    return pointsTable;
  } catch (error) {
    console.log("Error in calculating points", error);
    return false;
  }
};

const storeMatchResultService = async (matchName, result) => {
  try {
    var db = getDb();
    if (!db) {
      console.error("Database connection not available.");
      return false;
    }
    const newResult = {
      matchName,
      result,
    };

    const newMatchResult = await db
      .collection(DB_MATCH_COLLECTION_NAME)
      .insertOne(newResult);

    console.log("Added! new match result ID:", newMatchResult.insertedId);
    return true;
  } catch (error) {
    console.error("Failed to add new match result:", error);
    return false;
  }
};

// -------------------------------------------------------------------------------

const calculateTeamScores = (data) => {
  try {
    const playersScores = data.matchResult.result;

    // Loop through each team
    data.allTeams = data.allTeams.map((team) => {
      let totalPoints = 0;

      // Calculate points for each player in the team
      const playerPoints = team.players.map((playerName) => {
        const playerScore = playersScores[playerName] || {
          points: 0, // default points if player not found in matchResult
        };

        let points = playerScore.points;

        // Apply captain and vice-captain multipliers
        if (playerName === team.captain) {
          points *= 2; // Captain points are doubled
        } else if (playerName === team.viceCaptain) {
          points *= 1.5; // Vice-captain points are multiplied by 1.5
        }

        totalPoints += points; // Add to total points for the team

        return {
          playerName,
          points,
        };
      });

      team.playerPoints = playerPoints;
      team.totalPoints = totalPoints;

      return team;
    });

    return data?.allTeams;
  } catch (error) {
    console.log("Error occurred while calculating team scores:", error);
    return false;
  }
};

// -------------------------------------------------------------------------------

const teamResultService = async (matchName) => {
  try {
    const db = getDb();
    if (!db) {
      console.error("Database connection not available.");
      return false;
    }
    const matchResult = await db
      .collection(DB_MATCH_COLLECTION_NAME)
      .findOne({ matchName });
    const allTeams = await db.collection(DB_COLLECTION_NAME).find({}).toArray();
    const allTeamPoints = calculateTeamScores({ matchResult, allTeams });
    let finalResults;
    if (allTeamPoints) {
      const updatedRecords = await updateUserTeamsService(allTeamPoints, db);
      if (updatedRecords) {
        finalResults = getWinners(allTeamPoints);
      } else {
        return false;
      }
    } else {
      return false;
    }
    // console.log(allTeamPoints);
    return finalResults;
  } catch (error) {
    console.log("Error in team result service", error);
    return false;
  }
};

// -------------------------------------------------------------------------------

const updateUserTeamsService = async (allTeamPoints, db) => {
  try {
    allTeamPoints.map(async (a) => {
      const updates = {
        playerPoints: a.playerPoints,
        totalPoints: a.totalPoints,
      };
      const team = await db
        .collection(DB_COLLECTION_NAME)
        .updateOne({ _id: a._id }, { $set: updates });
    });
    return true;
  } catch (error) {
    console.log("Error while updating teams", error);
    return false;
  }
};

// -------------------------------------------------------------------------------

const getWinners = (allTeamPoints) => {
  allTeamPoints.sort((a, b) => b.totalPoints - a.totalPoints);

  const highestTotalPoints = allTeamPoints[0].totalPoints;
  const winners = allTeamPoints.filter(
    (team) => team.totalPoints === highestTotalPoints
  );

  const sortedTeams = allTeamPoints.map((team) => ({
    teamName: team.teamName,
    totalPoints: team.totalPoints,
  }));
  return { winners, sortedTeams };
};

// -------------------------------------------------------------------------------

module.exports = {
  validatePlayerEntries,
  validateTeamDetails,
  validateTeamCriteria,
  createTeamService,
  calculatePoints,
  storeMatchResultService,
  teamResultService,
};
