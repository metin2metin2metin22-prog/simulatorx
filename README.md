# 🎯 SimulatorX — CS:GO 5v5 Tactical Minimap Simulator

**SimulatorX**, Counter-Strike (CS:GO / CS2) maçlarını gerçek zamanlı 5v5 taktiksel mini harita (radar) üzerinde simüle eden, takım seçmeli, strateji belirlemeli ve gerçek zamanlı çok oyunculu (multiplayer) bir tarayıcı oyunudur.

![SimulatorX de_dust2 Minimap](public/assets/de_dust2.png)

---

## 🌟 Öne Çıkan Özellikler

1. **Büyük ve Yüksek Çözünürlüklü Mini Harita (Radar View):**
   - Orijinal Valve Steam de_dust2 radar haritası (1024x1024).
   - Bomba kurma bölgeleri (Site A ve Site B) animasyonlu halkalar.
   - Bomba kurma, çözme, C4 patlaması ve geri sayım uyarıları.

2. **5 v 5 Gerçek Zamanlı Maç Simülasyonu:**
   - **Counter-Terrorists (CT)** vs **Terrorists (T)**.
   - Her takımda 5 oyuncu / bot (s1mple, ZywOo, NiKo, device, m0NESY, b1t vb.).
   - Can barı (100 HP), Çelik yelek (AP), görüş konileri (Vision Cones), silah menzili ve tepme simülasyonu.

3. **Online Çok Oyunculu (Multiplayer) Desteği:**
   - WebSockets (Socket.IO) ile anlık veri eşitlemesi.
   - Oyuncular istedikleri takıma (CT veya T) ve slota (1-5) katılarak botun kontrolünü doğrudan devralabilir veya Spectator (İzleyici) olarak izleyebilir.
   - Haritaya tıklayarak operatifinizi doğrudan istediğiniz noktaya yönlendirebilirsiniz.

4. **Taktik ve Strateji Seçimi:**
   - **Terrorist Taktikleri:**
     - *Rush B (Cyka Blyat)*: Tünellerden B bölgesine hızlı hücum.
     - *Long A Execute*: Long kapılarından A bölgesine koordineli saldırı.
     - *A Split*: Short ve Long üzerinden A bölgesine eş zamanlı kıskaç.
     - *Mid to B Split*: Mid kapılarını kırarak CT Ramp üzerinden B'ye sızma.
     - *Default & Pick*: Harita kontrolü ve açık arama.
   - **Counter-Terrorist Taktikleri:**
     - *Standard 2-1-2*: 2 Long/A, 1 Mid AWP, 2 B savunması.
     - *Aggressive Long*: Long kapılarına flaşlı baskın.
     - *B Stack (Anti-Rush)*: B bölgesinde 3'lü çapraz ateş savunması.
     - *Catwalk Aggression*: Catwalk baskısı ile Mid kontrolü.
     - *Retake Defense*: Derin savunma ve kitlerle koordineli geri alma (retake).

5. **Gerçekçi Taktiksel Ekipmanlar ve Bomba Mekaniği:**
   - **Duman Bombası (Smoke):** Görüş hattını ve mermileri kesen duman bulutları.
   - **Flaş Bombası (Flashbang):** Patlama anında görüş konisinde olanları kör eder (`* *`).
   - **C4 Bomba Kurulumu:** 3.5 saniye kurulum süresi, 40 saniye patlama sayacı, frekansı giderek artan bip sesleri.
   - **İmha Kiti (Defuse Kit):** Kitli imha 5 saniye, kitsiz imha 10 saniye.

6. **Web Audio API Ses Motoru:**
   - Harici ses dosyalarına ihtiyaç duymadan tarayıcıda dinamik üretilen CS sesleri:
     - AK-47, M4A1-S, AWP, Desert Eagle, Tabanca ateş sesleri.
     - Bomba kuruldu, bip sesleri, imha edildi ve patlama efektleri.
     - Flaş bombası patlaması ve kulak çınlaması (tinnitus).
     - Kafa vuruşu "dink" metalik sesi.
     - "Counter-Terrorists Win" ve "Terrorists Win" anonsları ve fanfarları.

7. **Resmi CS:GO HUD & Skor Tablosu (TAB):**
   - Üst kısımda canlı oyuncu can durumları ve raund skoru.
   - Sağ üstte CS:GO tipi canlı Killfeed (Silah ve kafa vuruşu simgeleri).
   - `TAB` tuşu veya butonu ile açılan detaylı CS:GO Skor Tablosu (K, D, A, MVP, Para, Ping).
   - Raund sonu MVP kutlaması ve konuşma anonsu.

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- [Node.js](https://nodejs.org/) (v16 veya üstü)
- npm

### Adımlar

1. Depoyu klonlayın veya proje dizinine gidin:
   ```bash
   cd simulatorx
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

3. Simülatör sunucusunu başlatın:
   ```bash
   npm start
   ```

4. Tarayıcınızda açın:
   ```
   http://localhost:3000
   ```

---

## 🎮 Kontroller ve Kısayollar

| Tuş / Eylem | İşlev |
|---|---|
| **Sol Tık (Haritada)** | Seçili operatifinize o noktaya gitme emri verir. |
| **TAB** | CS:GO Skor Tablosunu açar / kapatır. |
| **F** | İleriye Flaş Bombası fırlatır. |
| **S** | Belirtilen konuma Smoke (Duman) atar. |
| **1x / 2x / 3x** | Simülasyon hızını ayarlar. |
| **🔊 Butonu** | Ses efektlerini açar / kapatır. |

---

## 📂 Proje Yapısı

```
simulatorx/
├── package.json
├── server.js              # Express + Socket.IO sunucusu ve maç simülasyon motoru
├── public/
│   ├── index.html         # Ana oyun arayüzü ve HUD
│   ├── style.css          # CS:GO temalı responsive arayüz stilleri
│   ├── js/
│   │   ├── main.js        # İstemci döngüsü ve Socket.IO yönetimi
│   │   ├── radar.js       # 60 FPS HTML5 Canvas minimap çizim motoru
│   │   ├── hud.js         # Can barı, killfeed, skor tablosu ve arayüz yöneticisi
│   │   ├── audio.js       # Web Audio API ses efektleri sentezleyicisi
│   │   └── mapData.js     # Dust II koordinatları, düğümleri ve strateji yolları
│   └── assets/
│       ├── de_dust2.png   # 1024x1024 Dust 2 radar haritası
│       ├── de_mirage.png  # Mirage radar haritası
│       ├── de_dust2.txt
│       └── de_mirage.txt
└── README.md
```

---

## 📄 Lisans
ISC License - CS:GO ve Counter-Strike, Valve Corporation'ın tescilli ticari markasıdır. Bu proje eğitim ve simülasyon amaçlı açık kaynaklı bir topluluk çalışmasıdır.
