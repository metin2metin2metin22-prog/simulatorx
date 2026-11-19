# 👔 SimulatorX — CS:GO Esports Team Manager & Coach Simulator

**SimulatorX**, oyuncuların doğrudan ateş etmediği; bir **Espor Takım Koçu ve Menajeri** olarak takımı yüksek seviyeli taktiklerle yönettiği, 5v5 gerçek zamanlı CS:GO menajerlik simülatörüdür.

İki taraf (CT Koçu vs T Koçu) çevrimiçi olarak takımlarının temposunu, ekonomi talimatlarını, strateji planını ve taktiksel molalarını yönetirken; profesyonel oyuncular (s1mple, ZywOo, NiKo, b1t, device vb.) harita üzerinde otonom olarak çatışır, bomba kurar/çözer ve utility kullanır.

![SimulatorX de_dust2](public/assets/de_dust2.png)

---

## 🌟 Bir Takım Koçu / Menajeri Olarak Neler Yapabilirsiniz?

### 1. Oyun Temposu ve Risk Talimatı (Pacing Directives)
- 🧠 **Kontrollü / Varsayılan:** Standart tempo, harita kontrolü sağlama ve bilgi toplama.
- ⚡ **Hızlı & Ofansif:** Yüksek tempo, giriş (entry) baskısı ve agresif alan daraltma.
- 🛡️ **Pasif & Açı Tut:** Savunma pozisyonunu bozmadan rakibin hata yapmasını bekleme.
- 🎲 **Yüksek Risk & Push:** Duman arkası zorlamalar, ani flaşlı peeking ve kumar oynamalar.

### 2. Takım Ekonomi Yönetimi (Economy Calls)
- 🔄 **Otomatik:** Oyuncular bütçelerine göre doğal olarak karar verir.
- 💰 **Full Buy:** Tüm takımın en iyi silahları (AK/M4/AWP), zırh ve teçhizatı kuşanması emri.
- 💵 **Force Buy:** Bütçe düşük olsa da son kuruşa kadar Galil/FAMAS/Deagle alarak risk alma emri.
- 🪙 **Eco (Save):** Parayı harcamayıp tabancayla oynama ve sonraki raunda bütçe hazırlama emri.

### 3. Taktik Tahtası (Strategy Selection)
- **Terrorist Taktikleri:** *Rush B*, *Long A Execute*, *A Split*, *Mid to B*, *Default & Pick*.
- **Counter-Terrorist Taktikleri:** *Standart 2-1-2*, *Agresif Long*, *B Stack*, *Catwalk Baskısı*, *Retake Hazırlığı*.

### 4. Taktiksel Mola (Tactical Timeout - 25s)
- Maç başına 2 mola hakkı.
- Mola alındığında oyun duraklar, koç oyunculara taktik verir, oyuncuların **tilt seviyesi sıfırlanır** ve moralleri yükselir.

### 5. Koç Telsizi & Motivasyon Yönetimi
- 🔥 *"Tempoyu artırın, vurun geçin!"* (+Moral)
- 🧘 *"Sakin kalın, tilt olmayın!"* (-Tilt)
- Oyuncuların moral ve tilt seviyeleri isabet oranlarını ve tepki hızlarını doğrudan etkiler.

---

## 🚀 Çalıştırma

```bash
cd simulatorx
npm install
npm start
```

Tarayıcınızda açın:
```
http://localhost:3000
```

---

## 🎮 Çok Oyunculu (Online) Koçluk
- Bir oyuncu **CT Takımı Koçu** olur (örneğin B1ad3).
- Diğer bir oyuncu **T Takımı Koçu** olur (örneğin zonic).
- İki menajer de karşı karşıya maçın kaderini çizerek takımlarına taktik verir!
