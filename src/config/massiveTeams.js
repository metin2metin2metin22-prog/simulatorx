// SimulatorX - 100+ Massive Bot Teams Catalog
// Provides 100+ authentic esports teams categorized across City, Regional, National, and Global tiers.

const { generateStarterRoster } = require('../utils/playerGenerator');
const { PRO_PLAYER_POOL } = require('./rosters');

// 1. ŞEHİR TAKIMLARI (City Teams - 40 Teams)
const CITY_TEAMS_DATA = [
  // İstanbul
  { id: 'city_kadikoy_bulls', name: 'Kadıköy Bulls', city: 'İstanbul', region: 'Marmara', icon: '🐂', color: '#c0392b', coach: 'Alper Kara', rating: 0.94 },
  { id: 'city_besiktas_esports', name: 'Beşiktaş Esports', city: 'İstanbul', region: 'Marmara', icon: '🦅', color: '#ffffff', coach: 'Sinan Demir', rating: 0.98 },
  { id: 'city_sariyer_marti', name: 'Sarıyer Martıları', city: 'İstanbul', region: 'Marmara', icon: '🕊️', color: '#0984e3', coach: 'Kaan Balcı', rating: 0.92 },
  { id: 'city_uskudar_knights', name: 'Üsküdar Knights', city: 'İstanbul', region: 'Marmara', icon: '🛡️', color: '#6c5ce7', coach: 'Ozan Çelik', rating: 0.95 },
  { id: 'city_bakirkoy_tigers', name: 'Bakırköy Tigers', city: 'İstanbul', region: 'Marmara', icon: '🐯', color: '#e17055', coach: 'Mert Akın', rating: 0.93 },
  { id: 'city_beyoglu_rebels', name: 'Beyoğlu Rebels', city: 'İstanbul', region: 'Marmara', icon: '⚡', color: '#d63031', coach: 'Berk Şahin', rating: 0.94 },
  { id: 'city_kartal_eagles', name: 'Kartal Eagles', city: 'İstanbul', region: 'Marmara', icon: '🦅', color: '#2d3436', coach: 'Tolga Çetin', rating: 0.93 },
  { id: 'city_maltepe_wolves', name: 'Maltepe Wolves', city: 'İstanbul', region: 'Marmara', icon: '🐺', color: '#00cec9', coach: 'Burak Koç', rating: 0.95 },
  
  // Ankara
  { id: 'city_cankaya_titans', name: 'Çankaya Titans', city: 'Ankara', region: 'İç Anadolu', icon: '🏛️', color: '#e67e22', coach: 'Serdar Güven', rating: 0.96 },
  { id: 'city_kecioren_hawks', name: 'Keçiören Hawks', city: 'Ankara', region: 'İç Anadolu', icon: '🦅', color: '#27ae60', coach: 'Hakan Aslan', rating: 0.93 },
  { id: 'city_kizilay_lions', name: 'Kızılay Lions', city: 'Ankara', region: 'İç Anadolu', icon: '🦁', color: '#e74c3c', coach: 'Ufuk Aydın', rating: 0.94 },
  { id: 'city_mamak_dragons', name: 'Mamak Dragons', city: 'Ankara', region: 'İç Anadolu', icon: '🐉', color: '#8e44ad', coach: 'Görkem Taş', rating: 0.92 },
  { id: 'city_etimesgut_storm', name: 'Etimesgut Storm', city: 'Ankara', region: 'İç Anadolu', icon: '⚡', color: '#f39c12', coach: 'Onur Kurt', rating: 0.93 },
  { id: 'city_yenimahalle_stars', name: 'Yenimahalle Stars', city: 'Ankara', region: 'İç Anadolu', icon: '⭐', color: '#00b894', coach: 'Zafer Öz', rating: 0.94 },

  // İzmir
  { id: 'city_kordon_sharks', name: 'Kordon Sharks', city: 'İzmir', region: 'Ege', icon: '🦈', color: '#0984e3', coach: 'Efe Deniz', rating: 0.95 },
  { id: 'city_karsiyaka_thunder', name: 'Karşıyaka Thunder', city: 'İzmir', region: 'Ege', icon: '⚡', color: '#00b894', coach: 'Volkan Yeşil', rating: 0.97 },
  { id: 'city_alsancak_blades', name: 'Alsancak Blades', city: 'İzmir', region: 'Ege', icon: '⚔️', color: '#e84393', coach: 'Cemil Doğan', rating: 0.94 },
  { id: 'city_goztepe_phoenix', name: 'Göztepe Phoenix', city: 'İzmir', region: 'Ege', icon: '🔥', color: '#d63031', coach: 'Tayfun Kaya', rating: 0.96 },
  { id: 'city_bornova_vipers', name: 'Bornova Vipers', city: 'İzmir', region: 'Ege', icon: '🐍', color: '#2ed573', coach: 'Selim Kurt', rating: 0.93 },
  { id: 'city_buca_gladiators', name: 'Buca Gladiators', city: 'İzmir', region: 'Ege', icon: '🛡️', color: '#ffa502', coach: 'Tarık Demir', rating: 0.94 },

  // Bursa
  { id: 'city_nilufer_crocs', name: 'Nilüfer Crocs', city: 'Bursa', region: 'Marmara', icon: '🐊', color: '#2ecc71', coach: 'Semih Yılmaz', rating: 0.95 },
  { id: 'city_uludag_bears', name: 'Uludağ Bears', city: 'Bursa', region: 'Marmara', icon: '🐻', color: '#34495e', coach: 'Kemal Dağ', rating: 0.94 },
  { id: 'city_osmangazi_warriors', name: 'Osmangazi Warriors', city: 'Bursa', region: 'Marmara', icon: '⚔️', color: '#e74c3c', coach: 'Batuhan Er', rating: 0.93 },

  // Antalya
  { id: 'city_kaleici_pirates', name: 'Kaleiçi Pirates', city: 'Antalya', region: 'Akdeniz', icon: '🏴‍☠️', color: '#f39c12', coach: 'Deniz Ak', rating: 0.94 },
  { id: 'city_lara_dolphins', name: 'Lara Dolphins', city: 'Antalya', region: 'Akdeniz', icon: '🐬', color: '#00cec9', coach: 'Ender Mavi', rating: 0.93 },
  { id: 'city_konyaalti_suns', name: 'Konyaaltı Suns', city: 'Antalya', region: 'Akdeniz', icon: '☀️', color: '#fdcb6e', coach: 'Yavuz Gün', rating: 0.95 },

  // Diğer Büyük Şehirler
  { id: 'city_trabzon_storm', name: 'Trabzon Storm', city: 'Trabzon', region: 'Karadeniz', icon: '🌊', color: '#74b9ff', coach: 'Fatih Bordo', rating: 0.97 },
  { id: 'city_adana_fire', name: 'Adana Fire', city: 'Adana', region: 'Akdeniz', icon: '🔥', color: '#ff7675', coach: 'Cengiz Sıcak', rating: 0.96 },
  { id: 'city_eskisehir_redhawks', name: 'Eskişehir RedHawks', city: 'Eskişehir', region: 'İç Anadolu', icon: '🦅', color: '#d63031', coach: 'İlker Şen', rating: 0.95 },
  { id: 'city_diyarbakir_stars', name: 'Diyarbakır Stars', city: 'Diyarbakır', region: 'Güneydoğu Anadolu', icon: '⭐', color: '#fdcb6e', coach: 'Baran Çetin', rating: 0.93 },
  { id: 'city_konya_falcons', name: 'Konya Falcons', city: 'Konya', region: 'İç Anadolu', icon: '🦅', color: '#00b894', coach: 'Ahmet Kartal', rating: 0.92 },
  { id: 'city_samsun_gladiators', name: 'Samsun Gladiators', city: 'Samsun', region: 'Karadeniz', icon: '⚔️', color: '#d63031', coach: 'Hüseyin Alp', rating: 0.94 },
  { id: 'city_gaziantep_leopards', name: 'Gaziantep Leopards', city: 'Gaziantep', region: 'Güneydoğu Anadolu', icon: '🐆', color: '#e17055', coach: 'Ramazan Tek', rating: 0.95 },
  { id: 'city_kayseri_panthers', name: 'Kayseri Panthers', city: 'Kayseri', region: 'İç Anadolu', icon: '🐾', color: '#636e72', coach: 'Şükrü Dağ', rating: 0.93 },
  { id: 'city_denizli_roosters', name: 'Denizli Roosters', city: 'Denizli', region: 'Ege', icon: '🐓', color: '#d63031', coach: 'Oktay Horoz', rating: 0.94 },
  { id: 'city_mersin_corsairs', name: 'Mersin Corsairs', city: 'Mersin', region: 'Akdeniz', icon: '⚓', color: '#0984e3', coach: 'Barış Deniz', rating: 0.93 },
  { id: 'city_sakarya_engines', name: 'Sakarya Engines', city: 'Sakarya', region: 'Marmara', icon: '⚙️', color: '#2d3436', coach: 'Bülent Çark', rating: 0.92 },
  { id: 'city_kocaeli_titans', name: 'Kocaeli Titans', city: 'Kocaeli', region: 'Marmara', icon: '🦾', color: '#00cec9', coach: 'Cihan Körfez', rating: 0.94 },
  { id: 'city_aydin_eagles', name: 'Aydın Eagles', city: 'Aydın', region: 'Ege', icon: '🦅', color: '#fdcb6e', coach: 'Metin Zeytin', rating: 0.92 },
  { id: 'city_tekirdag_knights', name: 'Tekirdağ Knights', city: 'Tekirdağ', region: 'Marmara', icon: '🛡️', color: '#6c5ce7', coach: 'Nazım Şarap', rating: 0.93 }
];

// 2. BÖLGE TAKIMLARI (Regional Teams - 30 Teams)
const REGIONAL_TEAMS_DATA = [
  // Marmara Bölgesi
  { id: 'reg_marmara_predators', name: 'Marmara Predators', region: 'Marmara', icon: '🦈', color: '#0984e3', coach: 'Turgut Kaplan', rating: 1.02 },
  { id: 'reg_trakya_reapers', name: 'Trakya Reapers', region: 'Marmara', icon: '☠️', color: '#d63031', coach: 'Bora Biçer', rating: 1.01 },
  { id: 'reg_canakkale_sailors', name: 'Çanakkale Sailors', region: 'Marmara', icon: '⚓', color: '#00cec9', coach: 'Mehmet Boğaz', rating: 1.03 },
  { id: 'reg_bogazici_wolves', name: 'Boğaziçi Wolves', region: 'Marmara', icon: '🐺', color: '#6c5ce7', coach: 'Kaan Boğaz', rating: 1.04 },
  { id: 'reg_yalova_gulf', name: 'Yalova Gulf', region: 'Marmara', icon: '🌊', color: '#74b9ff', coach: 'Cem Termal', rating: 1.00 },

  // Ege Bölgesi
  { id: 'reg_ege_thunder', name: 'Ege Thunder', region: 'Ege', icon: '⚡', color: '#f39c12', coach: 'Barış Şen', rating: 1.04 },
  { id: 'reg_efes_spartans', name: 'Efes Spartans', region: 'Ege', icon: '🛡️', color: '#e67e22', coach: 'Dionysos Er', rating: 1.02 },
  { id: 'reg_smyrna_legion', name: 'Smyrna Legion', region: 'Ege', icon: '⚔️', color: '#e84393', coach: 'Atilla Körfez', rating: 1.03 },
  { id: 'reg_mugla_marines', name: 'Muğla Marines', region: 'Ege', icon: '🛥️', color: '#00cec9', coach: 'Halil Koy', rating: 1.01 },
  { id: 'reg_bergama_pergamum', name: 'Bergama Pergamum', region: 'Ege', icon: '📜', color: '#ffeaa7', coach: 'Arif Antik', rating: 1.00 },

  // Akdeniz Bölgesi
  { id: 'reg_akdeniz_corsairs', name: 'Akdeniz Corsairs', region: 'Akdeniz', icon: '🏴‍☠️', color: '#e74c3c', coach: 'Barbaros Deniz', rating: 1.05 },
  { id: 'reg_toros_kaplanlari', name: 'Toros Kaplanları', region: 'Akdeniz', icon: '🐯', color: '#d35400', coach: 'Burak Doğan', rating: 1.04 },
  { id: 'reg_kilikya_titans', name: 'Kilikya Titans', region: 'Akdeniz', icon: '🏛️', color: '#8e44ad', coach: 'Şahin Kaya', rating: 1.02 },
  { id: 'reg_pamphylia_phoenix', name: 'Pamphylia Phoenix', region: 'Akdeniz', icon: '🔥', color: '#ff7675', coach: 'Serhat Kum', rating: 1.01 },
  { id: 'reg_likya_pathfinders', name: 'Likya Pathfinders', region: 'Akdeniz', icon: '🏹', color: '#00b894', coach: 'Ozan Yol', rating: 1.03 },

  // Karadeniz Bölgesi
  { id: 'reg_karadeniz_firtinasi', name: 'Karadeniz Fırtınası', region: 'Karadeniz', icon: '🌊', color: '#2980b9', coach: 'Emre Kurt', rating: 1.04 },
  { id: 'reg_pontus_warriors', name: 'Pontus Warriors', region: 'Karadeniz', icon: '⚔️', color: '#2c3e50', coach: 'Temel Dağ', rating: 1.02 },
  { id: 'reg_dogu_karadeniz_hawks', name: 'Doğu Karadeniz Hawks', region: 'Karadeniz', icon: '🦅', color: '#16a085', coach: 'İdris Yayla', rating: 1.03 },
  { id: 'reg_rize_tea_tigers', name: 'Rize Tea Tigers', region: 'Karadeniz', icon: '🍃', color: '#27ae60', coach: 'Dursun Yeşil', rating: 1.01 },
  { id: 'reg_sinop_lighthouse', name: 'Sinop Lighthouse', region: 'Karadeniz', icon: '🏮', color: '#f1c40f', coach: 'Ali Fener', rating: 1.00 },

  // İç Anadolu Bölgesi
  { id: 'reg_anadolu_genclik', name: 'Anadolu Gençlik', region: 'İç Anadolu', icon: '🦅', color: '#16a085', coach: 'Murat Yılmaz', rating: 1.03 },
  { id: 'reg_bozkir_kurtlari', name: 'Bozkır Kurtları', region: 'İç Anadolu', icon: '🐺', color: '#7f8c8d', coach: 'Kürşad Bozkır', rating: 1.04 },
  { id: 'reg_kapadokya_mystics', name: 'Kapadokya Mystics', region: 'İç Anadolu', icon: '🎈', color: '#e84393', coach: 'Peri Baca', rating: 1.02 },
  { id: 'reg_erciyes_blizzard', name: 'Erciyes Blizzard', region: 'İç Anadolu', icon: '❄️', color: '#74b9ff', coach: 'Zirve Kar', rating: 1.01 },
  { id: 'reg_seymenler_squad', name: 'Seymenler Squad', region: 'İç Anadolu', icon: '💂', color: '#c0392b', coach: 'Oğuz Seymen', rating: 1.02 },

  // Doğu & Güneydoğu Bölgesi
  { id: 'reg_mezopotamya_stars', name: 'Mezopotamya Stars', region: 'Güneydoğu Anadolu', icon: '🌟', color: '#e67e22', coach: 'Yusuf Yıldız', rating: 1.03 },
  { id: 'reg_nemrut_giants', name: 'Nemrut Giants', region: 'Güneydoğu Anadolu', icon: '🗿', color: '#d35400', coach: 'Kommagene Alp', rating: 1.02 },
  { id: 'reg_dicle_lions', name: 'Dicle Lions', region: 'Güneydoğu Anadolu', icon: '🦁', color: '#f39c12', coach: 'Nehir Aslan', rating: 1.03 },
  { id: 'reg_van_monsters', name: 'Van Lake Monsters', region: 'Doğu Anadolu', icon: '🐉', color: '#0984e3', coach: 'Göl Canavarı', rating: 1.01 },
  { id: 'reg_palandoken_frost', name: 'Palandöken Frost', region: 'Doğu Anadolu', icon: '🏔️', color: '#dfe6e9', coach: 'Buz Adam', rating: 1.02 }
];

// 3. ÜLKE ESPOR SÜPER LİGİ TAKIMLARI (National Pro League - 20 Teams)
const NATIONAL_TEAMS_DATA = [
  { id: 'nat_sangal', name: 'Sangal Esports', country: 'TR', icon: '🔴', color: '#e74c3c', coach: 'Klisba', rating: 1.14 },
  { id: 'nat_bbl', name: 'BBL Esports', country: 'TR', icon: '🦁', color: '#f1c40f', coach: 'Vlad', rating: 1.15 },
  { id: 'nat_fut', name: 'FUT Esports', country: 'TR', icon: '🐺', color: '#e67e22', coach: 'SunPayus', rating: 1.16 },
  { id: 'nat_fire_flux', name: 'Fire Flux Esports', country: 'TR', icon: '☄️', color: '#e74c3c', coach: 'Marq', rating: 1.13 },
  { id: 'nat_supermassive', name: 'Papara SuperMassive', country: 'TR', icon: '🌀', color: '#0984e3', coach: 'Lethal', rating: 1.14 },
  { id: 'nat_dark_passage', name: 'Dark Passage', country: 'TR', icon: '🦅', color: '#2d3436', coach: 'Ertuğ', rating: 1.12 },
  { id: 'nat_wildcats', name: 'İstanbul Wildcats', country: 'TR', icon: '🐱', color: '#d63031', coach: 'Vortex', rating: 1.11 },
  { id: 'nat_parla', name: 'Parla Esports', country: 'TR', icon: '✨', color: '#a29bfe', coach: 'Blaze', rating: 1.10 },
  { id: 'nat_fenerbahce', name: '1907 Fenerbahçe Espor', country: 'TR', icon: '🟡', color: '#f1c40f', coach: 'Kanarya', rating: 1.13 },
  { id: 'nat_galatasaray', name: 'Galatasaray Espor', country: 'TR', icon: '🦁', color: '#c0392b', coach: 'Aslan Koç', rating: 1.13 },
  { id: 'nat_crew', name: 'Crew Esports', country: 'TR', icon: '👥', color: '#00b894', coach: 'Kaptan', rating: 1.09 },
  { id: 'nat_regnum_carya', name: 'Regnum Carya Esports', country: 'TR', icon: '👑', color: '#fdcb6e', coach: 'Kral', rating: 1.10 },
  { id: 'nat_digital_athletics', name: 'Digital Athletics', country: 'TR', icon: '👟', color: '#e17055', coach: 'Sprinter', rating: 1.11 },
  { id: 'nat_fastpay_wildcats', name: 'Anatolia Titans', country: 'TR', icon: '⚡', color: '#0984e3', coach: 'Volt', rating: 1.09 },
  { id: 'nat_thunderbolts', name: 'Thunderbolts Gaming', country: 'TR', icon: '🌩️', color: '#6c5ce7', coach: 'Gök', rating: 1.10 },
  { id: 'nat_gamebedava', name: 'Gamebedava Esports', country: 'TR', icon: '🎮', color: '#00cec9', coach: 'Gamer', rating: 1.08 },
  { id: 'nat_next_generation', name: 'Next Generation', country: 'TR', icon: '🚀', color: '#ff7675', coach: 'Next', rating: 1.09 },
  { id: 'nat_cyber_warriors', name: 'Cyber Warriors TR', country: 'TR', icon: '🤖', color: '#636e72', coach: 'Cyber', rating: 1.08 },
  { id: 'nat_alesta', name: 'Alesta Gaming', country: 'TR', icon: '⛵', color: '#74b9ff', coach: 'Reis', rating: 1.07 },
  { id: 'nat_anatolian_guardians', name: 'Anatolian Guardians', country: 'TR', icon: '🛡️', color: '#2ecc71', coach: 'Muhafız', rating: 1.10 }
];

// 4. DÜNYA PRO ŞAMPİYONLAR LİGİ TAKIMLARI (Global Champions League - 16 Teams)
const GLOBAL_TEAMS_DATA = [
  { id: 'glob_vitality', name: 'Team Vitality', country: 'FR', icon: '🐝', color: '#f39c12', coach: 'XTQZZZ', rating: 1.28, playerIds: ['zywoo', 'apex', 'spinx', 'flamez', 'mezii'] },
  { id: 'glob_spirit', name: 'Team Spirit', country: 'CIS', icon: '🐉', color: '#2ecc71', coach: 'hally', rating: 1.27, playerIds: ['chopper', 'donk', 'sh1ro', 'magixx', 'zont1x'] },
  { id: 'glob_navi', name: 'Natus Vincere', country: 'UA', icon: '🇺🇦', color: '#f1c40f', coach: 'B1ad3', rating: 1.26, playerIds: ['aleksib', 'im', 'b1t', 's1mple', 'w0nderful'] },
  { id: 'glob_faze', name: 'FaZe Clan', country: 'EU', icon: '🛡️', color: '#e74c3c', coach: 'NEO', rating: 1.25, playerIds: ['karrigan', 'rain', 'broky', 'frozen', 'ropz'] },
  { id: 'glob_g2', name: 'G2 Esports', country: 'EU', icon: '⚔️', color: '#ffffff', coach: 'TaZ', rating: 1.24, playerIds: ['snax', 'niko', 'm0nesy', 'hunter', 'malbsmd'] },
  { id: 'glob_mouz', name: 'MOUZ', country: 'EU', icon: '🐭', color: '#e74c3c', coach: 'sycrone', rating: 1.23, playerIds: ['siuhy', 'torzsi', 'xertion', 'jimpphat', 'brollan'] },
  { id: 'glob_eternal_fire', name: 'Eternal Fire', country: 'TR', icon: '🔥', color: '#e74c3c', coach: 'Fabre', rating: 1.22, playerIds: ['xantares', 'woxic', 'wicadia', 'calyx', 'maj3r'] },
  { id: 'glob_astralis', name: 'Astralis', country: 'DK', icon: '⭐', color: '#e74c3c', coach: 'ruggah', rating: 1.21 },
  { id: 'glob_virtus_pro', name: 'Virtus.pro', country: 'RU', icon: '🐻', color: '#e67e22', coach: 'PASHANOJ', rating: 1.20 },
  { id: 'glob_heroic', name: 'HEROIC', country: 'DK', icon: '🏹', color: '#d35400', coach: 'sAw', rating: 1.19 },
  { id: 'glob_cloud9', name: 'Cloud9', country: 'USA', icon: '☁️', color: '#00d2ff', coach: 'groove', rating: 1.19 },
  { id: 'glob_liquid', name: 'Team Liquid', country: 'USA', icon: '🐎', color: '#0984e3', coach: 'mithR', rating: 1.18 },
  { id: 'glob_complexity', name: 'Complexity', country: 'USA', icon: '⭐', color: '#2c3e50', coach: 'T.c', rating: 1.18 },
  { id: 'glob_fnatic', name: 'Fnatic', country: 'UK', icon: '🔥', color: '#f39c12', coach: 'keita', rating: 1.17 },
  { id: 'glob_ence', name: 'ENCE', country: 'FI', icon: '🦅', color: '#c0392b', coach: 'kuben', rating: 1.16 },
  { id: 'glob_aurora', name: 'Aurora Gaming', country: 'EU', icon: '❄️', color: '#00cec9', coach: 'Brain', rating: 1.15 }
];

/**
 * Builds and caches 100+ fully-formed teams with rosters
 */
function buildMassiveCatalog() {
  const catalog = {};

  const processList = (list, tierName) => {
    return list.map(item => {
      let roster = [];
      if (item.playerIds && Array.isArray(item.playerIds)) {
        roster = item.playerIds.map(id => PRO_PLAYER_POOL.find(p => p.id === id)).filter(Boolean);
      }
      if (roster.length < 5) {
        // Generate realistic roster
        roster = generateStarterRoster(item.name).map(p => {
          // Adjust stats based on team rating
          const bonus = Math.round((item.rating - 0.90) * 80);
          return {
            ...p,
            skills: {
              aim: Math.min(99, p.skills.aim + bonus),
              reflex: Math.min(99, p.skills.reflex + bonus),
              headshot: Math.min(98, p.skills.headshot + bonus),
              gamesense: Math.min(99, p.skills.gamesense + bonus),
              clutch: Math.min(99, p.skills.clutch + bonus),
              utility: Math.min(95, p.skills.utility + bonus),
              aggression: p.skills.aggression
            },
            rating: Number((p.rating + (item.rating - 1.0) * 0.7).toFixed(2))
          };
        });
      }

      return {
        id: item.id,
        name: item.name,
        shortTag: item.name.slice(0, 3).toUpperCase(),
        city: item.city || 'Ankara',
        region: item.region || 'Türkiye',
        country: item.country || 'TR',
        icon: item.icon,
        color: item.color,
        coachName: item.coach || item.coachName || 'Koç',
        rating: item.rating,
        tier: tierName,
        roster
      };
    });
  };

  catalog.city = processList(CITY_TEAMS_DATA, 'Şehir Ligi');
  catalog.regional = processList(REGIONAL_TEAMS_DATA, 'Bölge Ligi');
  catalog.national = processList(NATIONAL_TEAMS_DATA, 'Ülke Süper Ligi');
  catalog.global = processList(GLOBAL_TEAMS_DATA, 'Dünya Şampiyonlar Ligi');

  return catalog;
}

const MASSIVE_TEAMS_CATALOG = buildMassiveCatalog();

// Flat list of all 100+ teams
const ALL_100_TEAMS = [
  ...MASSIVE_TEAMS_CATALOG.city,
  ...MASSIVE_TEAMS_CATALOG.regional,
  ...MASSIVE_TEAMS_CATALOG.national,
  ...MASSIVE_TEAMS_CATALOG.global
];

module.exports = {
  MASSIVE_TEAMS_CATALOG,
  ALL_100_TEAMS
};
