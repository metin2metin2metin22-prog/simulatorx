# 🎯 SimulatorX — CS:GO Esports Takım Sahibi & Koç Simülatörü

**SimulatorX**, kulüp kurma, transfer pazarı, genç yetenek keşfi (scouting), kadro mühendisliği ve taktiksel koçluk mekaniklerini bir araya getiren saf bir **CS:GO / Counter-Strike Takım Sahibi Simülatörüdür**.

Oyunda takımlar sahadayken dışarıdan hileli müdahale yapılmaz; oyuncular kartlarındaki **Aim, Reflex, Headshot %, Game Sense, Clutch, Utility ve İmzalı Pasiflerine (Perk)** göre otonom olarak mücadele eder. Takım sahibi olarak kadronuzu yönetir, pazardan transfer yapar, genç yetenekleri keşfeder ve maç sırasında **Taktiksel Mola (Timeout)** alarak takımın moralini yönetirsiniz.

---

## 🌟 Temel Özellikler & Oyun Mimarisi

### 1. 👔 Takım Sahibi & Kadro Yönetimi (Roster Manager)
- **5 Kişilik Aktif Sahası:** İlk 5 kadronuzu dilediğiniz gibi şekillendirin.
- **Dinamik Transfer Pazarı:** Çaylaklardan Tier 1 Major MVP'lerine (s1mple, NiKo, donk, m0NESY, ZywOo, ropz vb.) uzanan geniş oyuncu havuzu.
- **🔍 Genç Yetenek Keşfi (Scouting):** 16-19 yaşlarında geleceğin yıldız adaylarını keşfetme ve altyapı sözleşmesi imzalama imkanı.
- **Özel Oyuncu Kartı Oluşturucu:** İstediğiniz ad, rol ve 30–100 arası yetenek değerleriyle kendi süperstarınızı yaratın.
- **Hazır Şablonlar (Presets):** Başlangıç Çaylak Kadrosu, Genç Scout Karması, FaZe Clan, All-Star Dream Team, NaVi Dynasty.

### 2. 🧮 30–100 Yetenek Ölçeği & Matematiksel Vuruş Motoru
- **Reaksiyon Süresi:** 100 reflekste ~100ms; 40 reflekste ~350ms gerçekçi insan tepki süresi.
- **Sprey Dağılımı:** Düşük aimli çaylaklar seri atışta sprey kontrolünü kaybederken, tecrübeli ustalar mermileri hedefe kilitler.
- **Kafadan Vuruş Eğrisi (HS%):** Üstel güç fonksiyonuyla NiKo / b1t gibi ustalar %55–%65 tek kurşun kafadan vuruş yaparken, çaylaklar %9–%12 seviyesindedir.
- **Clutch & Panik Mekaniği:** 1vX durumlarında clutch yeteneği düşük oyuncular heyecanlanır (`rookie_nervous`), soğukkanlı oyuncular (`ice_clutch`) isabet bonusu kazanır.

### 3. 🧠 Modüler Alt Sistemler Mimarisi (`src/engine/`)
Motor tek bir dev dosya yerine bağımsız, temiz ve birbirini tamamlayan alt sistemlerden oluşur:

| Modül | Sorumluluk Alanı |
|---|---|
| `MatchEngine.js` | Maç yaşam döngüsü, raunt durumları (`lobby`, `freeze`, `live`, `timeout`, `round_end`, `match_over`), skor ve etkinlik yayını. |
| `EconomySystem.js` | CS:GO tabanca rauntları (Kevlar vs Utility), Full Buy, Force Buy, Eco rauntları, Deagle pusu alımları ve silah dropları. |
| `MovementSystem.js` | Yol takibi (A* Pathfinding), siper açıları, koridor ayrışması, köşe sıyırma ve sıkışma önleyici (anti-stuck) mekanizma. |
| `CombatSystem.js` | Görüş konileri, duman engeli, silah hasar eğrileri, duvar geçme (wallbang), noscope ve öldürme olayları. |
| `BotTactics.js` | T & CT stratejileri, Mid to B Split, A Fake hücumu, duman perdesi, molotof söndürme ve bomba bölgesi savunması. |
| `BombManager.js` | C4 bomba taşıma, yere düşürme, 40 saniyelik patlama geri sayımı, bomba kurma ve kitli/kitsiz imha mekaniği. |
| `CollisionSystem.js` | Orijinal 1024x1024 de_dust2 piksel çarpışma maskesi ve raycasting görüş çizgisi hesaplaması. |

---

## 🚀 Kurulum ve Çalıştırma

```bash
cd simulatorx
npm install
npm start
```

Tarayıcınızda açın:
```
http://localhost:3000
```
