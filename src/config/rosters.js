// SimulatorX - Professional Esports Player Rosters & Skill Attributes
// Matches are decided purely by player skill attributes: Aim, Reflex, Game Sense, and Clutch.
const ROSTERS = {
  ct: [
    {
      name: 's1mple',
      role: 'Sniper (AWP)',
      tag: 'AWPer',
      rating: 1.30,
      skills: {
        aim: 98,
        reflex: 99,
        gamesense: 97,
        clutch: 98
      },
      desc: 'Tarihin en iyi CS oyuncusu; kusursuz AWP refleksleri ve 1vX clutch uzmanı.'
    },
    {
      name: 'b1t',
      role: 'Entry Fragger',
      tag: 'Entry',
      rating: 1.18,
      skills: {
        aim: 97,
        reflex: 95,
        gamesense: 92,
        clutch: 90
      },
      desc: 'Headshot makinesi; ilk mermi isabet oranı ve temiz one-tap uzmanı.'
    },
    {
      name: 'device',
      role: 'Second AWP / Rifler',
      tag: 'Sniper/Rifle',
      rating: 1.20,
      skills: {
        aim: 94,
        reflex: 92,
        gamesense: 97,
        clutch: 94
      },
      desc: 'Bay Tutarlılık; mükemmel crosshair yerleşimi ve hatasız pozisyon alma.'
    },
    {
      name: 'rain',
      role: 'Site Anchor',
      tag: 'Anchor',
      rating: 1.15,
      skills: {
        aim: 93,
        reflex: 91,
        gamesense: 94,
        clutch: 95
      },
      desc: 'Bomba alanlarının yıkılmaz kalesi; crossfire ve alan savunması ustası.'
    },
    {
      name: 'Twistzz',
      role: 'In-Game Leader (IGL)',
      tag: 'IGL / Rifler',
      rating: 1.19,
      skills: {
        aim: 96,
        reflex: 94,
        gamesense: 96,
        clutch: 93
      },
      desc: 'Kusursuz spray transferi, taktiksel oyun zekası ve sakin liderlik.'
    }
  ],
  t: [
    {
      name: 'ZywOo',
      role: 'Sniper (AWP)',
      tag: 'AWPer',
      rating: 1.32,
      skills: {
        aim: 98,
        reflex: 97,
        gamesense: 99,
        clutch: 99
      },
      desc: 'Seçilmiş kişi; insanüstü oyun zekası, pozisyon sezgisi ve clutch canavarı.'
    },
    {
      name: 'NiKo',
      role: 'Entry Fragger',
      tag: 'Entry',
      rating: 1.25,
      skills: {
        aim: 99,
        reflex: 96,
        gamesense: 94,
        clutch: 92
      },
      desc: 'Tarihin en iyi rifler oyuncusu; ölümcül Deagle & AK-47 girişi.'
    },
    {
      name: 'm0NESY',
      role: 'Second AWP / Star',
      tag: 'Star AWPer',
      rating: 1.27,
      skills: {
        aim: 97,
        reflex: 100,
        gamesense: 95,
        clutch: 96
      },
      desc: 'Dünyanın en hızlı reaksiyon süresine sahip harika çocuk; agresif flick shotlar.'
    },
    {
      name: 'electronic',
      role: 'In-Game Leader (IGL)',
      tag: 'IGL / Rifler',
      rating: 1.16,
      skills: {
        aim: 94,
        reflex: 93,
        gamesense: 95,
        clutch: 91
      },
      desc: 'Agresif alan açma ve sert çatışma lideri; takımı sırtlayan baskı.'
    },
    {
      name: 'ropz',
      role: 'Lurker',
      tag: 'Lurker',
      rating: 1.24,
      skills: {
        aim: 97,
        reflex: 94,
        gamesense: 99,
        clutch: 98
      },
      desc: 'Görünmez gölge; kusursuz rotasyon okuma, zamanlama ve sinsice arkalama.'
    }
  ]
};

module.exports = {
  ROSTERS
};
