# GPX Motion Graphics Studio — DaVinci Resolve Edition

[![Version](https://img.shields.io/badge/version-v2.1.0-blue.svg)](https://github.com/TheLittleRock/gpx-motion-studio)
[![Docker](https://img.shields.io/badge/docker-multi--arch-2496ED.svg?logo=docker&logoColor=white)](https://ghcr.io/thelittlerock/gpx-motion-studio)
[![ProRes 4444](https://img.shields.io/badge/alpha-ProRes_4444-orange.svg)](https://www.apple.com/final-cut-pro/docs/Apple_ProRes_White_Paper.pdf)
[![Canvas 60fps](https://img.shields.io/badge/canvas-60fps-success.svg)](#)

Vysoce výkonné grafické studio pro tvorbu dynamických video animací z tras **GPX** s nativní podporou průhledného alfa kanálu pro **DaVinci Resolve**, **Final Cut Pro** a **Premiere Pro**.

Aplikace běží lokálně nebo v Dockeru a umožňuje exportovat animované telemetrické HUDy, dynamické 3D průlety kamerou nad mapou, celkové přehledy tras i animace se zaměřením na konkrétní milníky.

---

## 🌟 Hlavní funkce v2.1.0

- **Dokonalé 1:1 škálování exportu:** Exportovaná videa v 1080p i nativním 4K UHD mají naprosto identické rozvržení, tloušťky čar, velikosti textů i pozice widgetů jako živý náhled ve webovém prohlížeči.
- **Vzdálenostní model trasy & synchronizovaný ořez:** Slidery ořezu, číselné kilometry i HUD odometr jsou v absolutní shodě. Zvolený kilometr odpovídá přesné poloze jezdce na mapě.
- **Plynulý cross-fading názvů řek při zoomu:** Názvy řek mají fixní kotevní body na křivce toku a při přibližování či oddalování mapy plynule mění průhlednost, aniž by poskakovaly po obrazovce.
- **Catmull-Rom spline meandry pro řeky a silnice:** Pomocí sliderů meandrů (1 až 5) lze nastavit organické zakřivení toků i silnic I. a II. třídy s vysokým rozlišením křivek.
- **Dynamická detekce koridoru 35 km okolo GPX:** Při nahrání nebo výběru jakéhokoliv GPX souboru se automaticky spočítá 35km koridor a načtou se relevantní města, obce, hrady, zámky, rozhledny i vrcholy.
- **Inteligentní zamezení kolizím textů:** Pokročilý `LabelCollisionResolver` eliminuje překrývání názvů (např. Sedlec-Prčice a Miličín) tím, že upřednostňuje důležitější milníky a zabraňuje nečitelným shlukům.
- **Spolehlivý Pre-cache mapových dlaždic:** Před spuštěním renderu exportér předem stáhne všechny potřebné dlaždice do paměti. Všechny snímky se generují bez prodlev a chybějících částí mapy.
- **Vícefázový progressbar & FPS:** Přesné zobrazení stavu exportu:
  - *Fáze 1/3: Stahuji mapové dlaždice (X/Y)*
  - *Fáze 2/3: Generuji snímky (X/N • FPS)*
  - *Fáze 3/3: Kóduji přes FFmpeg*
- **Správce exportních úloh:** Přehledné okno s běžícími i hotovými exporty s možností stažení, přejmenování, pozastavení a mazání.
- **Speed & Zoom Ramping:** Editovatelné Bézierovy křivky pro plynulé zrychlení či zpomalení jízdy a dynamický zoom kamery podél trasy (odstranění bodu dvojklikem).
- **Snapshoty projektů:** Ukládání celých konfigurací scény (barvy, ořez, widgety, vrstvy) do SQLite databáze.

---

## 🚀 Rychlý start a spuštění

Vyberte si způsob spuštění, který vám nejvíce vyhovuje:

### Možnost A: Docker Compose (Doporučeno pro servery a NAS)

1. Stáhněte si `docker-compose.yml` (nebo naklonujte repozitář):
```bash
git clone https://github.com/TheLittleRock/gpx-motion-studio.git
cd gpx-motion-studio
docker compose up -d
```
2. Otevřete prohlížeč na adrese: **http://localhost:8000** (nebo IP adrese vašeho serveru).

---

### Možnost B: Spuštění v Portaineru (Stack Deployment)

1. Otevřete své webové rozhraní **Portaineru**.
2. V levém menu přejděte na **Stacks** ➔ **Add stack**.
3. Pojmenujte stack, např. `gpx-motion-studio`.
4. Jako **Build method** zvolte **Web editor** a vložte následující konfiguraci:

```yaml
version: '3.8'

services:
  gpx-motion-studio:
    image: ghcr.io/thelittlerock/gpx-motion-studio:latest
    container_name: gpx-motion-studio
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      # Trvalé úložiště pro projekty, nastavení a cache
      - gpx_data:/app/data
      # Hotová vyexportovaná videa (ProRes, WebM, MP4)
      - gpx_exports:/app/exports
      # Nahrané GPX soubory a podkladové obrázky
      - gpx_assets:/app/assets
    environment:
      - PYTHONUNBUFFERED=1

volumes:
  gpx_data:
  gpx_exports:
  gpx_assets:
```

5. Klikněte na **Deploy the stack**.
6. Aplikace bude dostupná na portu `8000`.

---

### Možnost C: Docker One-Liner (Rychlé vyzkoušení)

Spusťte předpřipravený multi-arch image přímo z GitHub Container Registry:

```bash
docker run -d \
  --name gpx-motion-studio \
  -p 8000:8000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/exports:/app/exports \
  --restart unless-stopped \
  ghcr.io/thelittlerock/gpx-motion-studio:latest
```

---

### Možnost D: Lokální instalace (Python 3.10+)

Pokud chcete aplikaci spouštět přímo na svém počítači:

1. **Požadavky:** Python 3.10+, FFmpeg nainstalovaný v systému (`sudo apt install ffmpeg` na Linuxu nebo `brew install ffmpeg` na Macu).
2. **Klonování repozitáře a instalace závislostí:**
```bash
git clone https://github.com/TheLittleRock/gpx-motion-studio.git
cd gpx-motion-studio
pip install -r requirements.txt
```
3. **Spuštění serveru:**
```bash
python3 server.py
```
4. Otevřete v prohlížeči **http://localhost:8000**.

---

## 🎬 Přehled exportních formátů a doporučení

| Formát exportu | Alfa kanál (Průhlednost) | Doporučené použití | Popis a výhody |
| :--- | :---: | :--- | :--- |
| **Apple ProRes 4444 (.mov)** | ✅ **ANO** | **DaVinci Resolve**, Final Cut Pro, Premiere Pro | **Filmový standard v 10/12-bit kvalitě.** Vloží se do video stopy nad záznam z kamery (GoPro / dron) s nulovými ztrátami a nativní průhledností bez nutnosti klíčování. |
| **WebM VP9 Transparent (.webm)** | ✅ **ANO** | **OBS Studio**, webové přehrávače, prezentace | **Moderní a úsporný formát.** Až 5x menší velikost souboru než ProRes při zachování průhledného pozadí. Ideální pro živé vysílání nebo rychlé náhledy. |
| **MP4 H.264 (.mp4)** | ❌ *Plné pozadí* | **YouTube**, Instagram, TikTok, přímé sdílení | **Univerzální video soubor.** Exportuje se kompletní scéna včetně mapového podkladu, widgetů a popisků. Přehraje ho jakýkoliv telefon i televize. |
| **Fusion Macro (.setting)** | ✅ **ANO** | DaVinci Resolve Fusion Page | **Vektorová animace přímo v DaVinci.** Zkopíruje se do schránky a vloží (`Ctrl+V`) do Fusion nodů. Animuje se nativní křivka `WriteOnEnd`. |

---

## 🗺️ Režimy animace

1. **Průhledný telemetrický HUD (Mode 1):**
   - Určeno pro overlay přes cyklo/moto video.
   - Obsahuje přizpůsobitelnou rohovou minimapu, výškový profil s barevným stoupáním, telemetrické sloty (vzdálenost, nadmořská výška, čas jízdy, sklon) a animované karty milníků.
2. **Dynamický průlet nad mapou (Mode 2):**
   - Kamera plynule sleduje jezdce s nastavitelným odpružením (damping), dynamickým natáčením ve směru jízdy (heading) a plynulým zoomem.
3. **Přehled celé trasy (Mode 3):**
   - Celkový pohled na celou délku trasy s plynulým dokreslováním projeté části a pulzujícím ukazatelem polohy.
4. **Boční rozdělení - Split View (Mode 5):**
   - Levý sloupec s výškovým profilem a telemetrií, pravá část s přehlednou mapou. Mapu lze libovolně posouvat a zoomovat.
5. **Bodový reflektor (Mode 4):**
   - Plynulý nálet kamery na konkrétní zájmový bod nebo město s plynulým náběhem a návratem.

---

## ⌨️ Klávesové zkratky a ovládání

- `Mezerník`: Spustit / Pozastavit přehrávání (Play / Pause)
- `Šipka vlevo / vpravo`: Krok o 1 snímek zpět / vpřed
- `Dvojklik na bod křivky`: Odstranění bodu v editoru rychlosti (Speed) a přiblížení (Zoom)
- `Tažení widgetů myší`: Přímé přesouvání ukazatelů po obrazovce
- `Kolečko myši nad widgetem`: Plynulá změna měřítka vybraného prvku

---

## 📄 Licence a autor

Vytvořil **TheLittleRock** pro komunitu cyklistů, tvůrců videí a uživatelů DaVinci Resolve.  
Projekt je šířen pod otevřenou licencí MIT.
