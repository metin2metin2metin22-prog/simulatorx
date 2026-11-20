// SimulatorX - Esports Match Replay Engine
// Generates, persists, and serves comprehensive match replays with HLTV box-scores and round recaps.

const fs = require('fs');
const path = require('path');

const REPLAYS_FILE = path.join(__dirname, '../../data/replays.json');

class ReplayManager {
  constructor() {
    this.replays = {};
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(REPLAYS_FILE)) {
        const raw = fs.readFileSync(REPLAYS_FILE, 'utf8');
        this.replays = JSON.parse(raw);
      } else {
        this.save();
      }
    } catch (err) {
      console.error('[ReplayManager] Failed to load replays:', err.message);
      this.replays = {};
    }
  }

  save() {
    try {
      const dir = path.dirname(REPLAYS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(REPLAYS_FILE, JSON.stringify(this.replays, null, 2), 'utf8');
    } catch (err) {
      console.error('[ReplayManager] Failed to save replays:', err.message);
    }
  }

  /**
   * Generates a realistic round-by-round replay package
   */
  createReplay({
    matchId,
    homeTeam,
    awayTeam,
    score,
    tierName = 'Espor Ligi',
    weekName = 'Hafta Maçı',
    date = new Date().toLocaleString('tr-TR')
  }) {
    const replayId = `rep_${matchId || Date.now()}`;
    const totalRounds = score.homeScore + score.awayScore;
    const homeWon = score.homeScore > score.awayScore;
    const winnerTeam = homeWon ? homeTeam : awayTeam;

    // 1. Generate Player Box Scores (HLTV Style)
    const generateTeamBox = (team, isWinner) => {
      const roster = team.roster && team.roster.length === 5 ? team.roster : [
        { name: 'Oyuncu 1', role: 'Entry' },
        { name: 'Oyuncu 2', role: 'AWPer' },
        { name: 'Oyuncu 3', role: 'Rifler' },
        { name: 'Oyuncu 4', role: 'Support' },
        { name: 'Oyuncu 5', role: 'IGL' }
      ];

      return roster.map((player, idx) => {
        const baseKills = isWinner ? (14 + Math.floor(Math.random() * 12)) : (8 + Math.floor(Math.random() * 9));
        const deaths = isWinner ? (9 + Math.floor(Math.random() * 7)) : (14 + Math.floor(Math.random() * 8));
        const assists = 2 + Math.floor(Math.random() * 6);
        const hsPercent = Math.min(85, Math.max(30, (player.skills?.headshot || 50) + Math.floor((Math.random() - 0.5) * 15)));
        const adr = Number(((baseKills * 3.8 + Math.random() * 20)).toFixed(1));
        const rating = Number((((baseKills - deaths * 0.45) / 10) + 0.55 + Math.random() * 0.2).toFixed(2));

        return {
          id: player.id || `p_${idx}`,
          name: player.name,
          role: player.role || 'Rifler',
          perk: player.perk || 'onetap_god',
          kills: baseKills,
          deaths,
          assists,
          adr,
          hsPercent,
          rating
        };
      }).sort((a, b) => b.rating - a.rating);
    };

    const homeBox = generateTeamBox(homeTeam, homeWon);
    const awayBox = generateTeamBox(awayTeam, !homeWon);

    // Determine MVP
    const mvpCandidate = homeWon ? homeBox[0] : awayBox[0];
    const matchMvp = {
      name: mvpCandidate.name,
      team: homeWon ? homeTeam.name : awayTeam.name,
      kills: mvpCandidate.kills,
      deaths: mvpCandidate.deaths,
      rating: mvpCandidate.rating
    };

    // 2. Generate Round-by-Round Breakdown
    const HIGHLIGHT_EVENTS = [
      '{p} dar açıda bekleyerek 1-tap tabanca vuruşuyla silah çaldı!',
      '{p} AWP ile Mid kapılarında inanılmaz bir açılış vuruşu yaptı!',
      'Organize A Execute: Sis perdesi ve flash kombinasyonuyla site düştü.',
      '{p} 1v2 gergin clutch pozisyonunda soğukkanlılıkla C4 imha etti!',
      'B Bölgesine şok T baskını (Rush B) CT savunmasını hazırlıksız yakaladı.',
      '{p} duman içerisinden (smoke spray) 2 rakip oyuncuyu avladı!',
      'Gecikmiş AWP rotasyonu ile A Long temizlendi.',
      '{p} son saniyede defuse kit ile 0.4 saniye kala bombayı çözdü!'
    ];

    const rounds = [];
    let curHome = 0;
    let curAway = 0;

    for (let r = 1; r <= totalRounds; r++) {
      // Determine round winner according to final score ratio
      const homeRemaining = score.homeScore - curHome;
      const awayRemaining = score.awayScore - curAway;
      const probHome = homeRemaining / (homeRemaining + awayRemaining || 1);
      const isHomeRound = Math.random() < probHome;

      if (isHomeRound && curHome < score.homeScore) curHome++;
      else if (curAway < score.awayScore) curAway++;
      else curHome++;

      const winningTeam = isHomeRound ? homeTeam : awayTeam;
      const winningBox = isHomeRound ? homeBox : awayBox;
      const roundMvp = winningBox[Math.floor(Math.random() * winningBox.length)];

      const rawHighlight = HIGHLIGHT_EVENTS[Math.floor(Math.random() * HIGHLIGHT_EVENTS.length)];
      const formattedHighlight = rawHighlight.replace('{p}', roundMvp.name);

      const winTypes = ['elimination', 'defuse', 'explosion'];
      const winType = winTypes[Math.floor(Math.random() * winTypes.length)];

      rounds.push({
        roundNum: r,
        winnerSide: isHomeRound ? 'home' : 'away',
        winningTeamName: winningTeam.name,
        winningTeamIcon: winningTeam.icon || '🛡️',
        winType,
        scoreAfter: `${curHome} - ${curAway}`,
        mvp: roundMvp.name,
        highlight: formattedHighlight
      });
    }

    const replay = {
      replayId,
      matchId,
      tierName,
      weekName,
      date,
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.name,
        icon: homeTeam.icon,
        color: homeTeam.color
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.name,
        icon: awayTeam.icon,
        color: awayTeam.color
      },
      score: {
        home: score.homeScore,
        away: score.awayScore
      },
      winner: {
        id: winnerTeam.id,
        name: winnerTeam.name,
        icon: winnerTeam.icon
      },
      matchMvp,
      homeBox,
      awayBox,
      rounds
    };

    this.replays[replayId] = replay;
    this.save();
    return replay;
  }

  getReplay(replayId) {
    if (!replayId) return null;
    return this.replays[replayId] || null;
  }

  getReplaysForUser(userClubId, limit = 10) {
    if (!userClubId) return [];
    return Object.values(this.replays)
      .filter(r => r.homeTeam?.id === userClubId || r.awayTeam?.id === userClubId)
      .reverse()
      .slice(0, limit);
  }
}

const replayManager = new ReplayManager();

module.exports = {
  replayManager,
  ReplayManager
};
