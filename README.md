# Tide — Son Fener

Canvas 2D ve Web Audio ile çalışan, gece denizciliği ve gelgit keşfi oyunu. Mevcut tekne fiziği, rastgele gelgit süreleri, kurtarma ve ses çekirdeğinin üzerine dört bağlantılı bölge, hava, dalış, panik, görevler ve tamamlanabilir bir hikâye eklendi.

## Çalıştırma

`npm start` → http://127.0.0.1:57372

Oyunun çalışma zamanı bağımlılığı ve derleme adımı yoktur; `index.html` doğrudan da açılabilir. Yerel kayıtların aynı kökende kalması için sunucuyu kullanmak önerilir. Cinzel ve Inter yüklenemezse sistem yazı tipleri kullanılır.

## Kontroller

- WASD / oklar: hareket. Boşluk: fren. R: tamir. E: bağlama, toplama, kurtarma, vinç, mahzen, bölge geçidi ve teslimat.
- M: harita. Takımadalar ve **Kıyı ve dönüş yolu** görünümleri arasında geçiş yapılabilir. Esc: duraklat / açık pencereyi kapat.
- Haritanın altındaki rota düğmesi bir deniz geçidini hedefler. İşarete git, yavaşla ve E ile geç. Geçitler arası ulaşım yükünü ve gelgit zamanını korur.
- Dokunmatik cihazlarda yönler, fren ve bağlamsal etkileşim düğmesi kullanılabilir.
- Ses düğmesi açık, kısık ve sessiz arasında geçer. Ses ilk kullanıcı etkileşiminde başlar; duraklama ve arka plan sekmesinde kısılır.

## İlk sefer ve ilerleme

1. Sular çekilince limanın doğusundaki kıyıya yavaşça yanaş ve E ile karaya çık. Boğulmuş Kaptanın Günlüğü ilk fener geliştirmesini açar. Ana ilerleme eseri ekipman kilitli mahzende üretilmez.
2. Buluntuları tekneyle iskeleye getirip indir. Liman panelinden yükselt. Fener Sokağı → Eski Tersane → İnci Mahallesi yerel rotaları ilerlemeyle açılır; yeni rota aktif düşük su seferini değiştirmez.
3. Yardım ışıklarını takip et. Demirci, Fenerci, Tersane Ustası ve Haritacı kurtarıldıklarında limana yerleşir. Uygun üç kurtarma denemesinde en az bir yardım çağrısı üretilir; taşınan yolcu varken yenisi çıkmaz.
4. Demirci pruva feneri, mercek, motor ve zırh; Fenerci dalış feneri ve çizmeler; Tersane Ustası tekne vinci satar. Atölye projeleri kapasiteyi, ışığı veya hızı artırır. Çizmeler ıslak zemindeki yavaşlamayı da azaltır.
5. Limandan doğuya **Batık Eski Mahalle**, oradan kuzeye **Kayalık Fener Adası**, adadan doğuya **Yasaklı Batık Katedral** bulunur. Bunlar aynı gelgit saatini paylaşan bağlantılı deniz sektörleridir. Katedral geçidi hem motor hem zırh gerektirir.
6. Katedralin dört eserini teslim et ve üç ana liman geliştirmesini bitir. Limandaki **Son feneri yak** düğmesi hikâyeyi tamamlar; limana kalıcı şafak gelir. Keşif ve ticarete devam edilebilir.

## Risk ve ödül

**Hava:** Açık gece, sürüklenen sis ve şimşekli fırtına birbirine geçer. Sis görüşü azaltır; fırtına tekneyi sürükler. Şimşek su altındaki şehrin silüetini ortaya çıkarır. Katedral sürekli fırtınalıdır. Azaltılmış hareket tercihinde parlama şiddeti düşürülür ve halüsinasyon hareketleri kapatılır.

**Vinç:** Su yüksekken, vinç donanımıyla parlayan ağır kasaya yaklaş ve yavaşla. Çekim beş saniye sürer; dümen kullanımı veya uzaklaşma çekimi keser. Her bölgenin ağır kasası aynı gelgit içinde yalnızca bir kez alınır. Kasalar ağırdır, teknenin yükünü etkiler.

**Mahzen:** Her bölgede bir kasa mühürlü mahzendir. Dalış feneri ve çizmelerle, su çekilmişken girilir. Mührün açılması dokuz saniye, hava bütçesi otuz saniyedir. Su yükselirse hava 2,5 kat hızlı tükenir. E ile istediğin an çıkabilirsin. Hava biterse emniyet halatı tekneye çeker: bir yük kaybolur, gövde 15 hasar alır ve panik yükselir.

**Panik:** Karanlık kıyı, fırtına, mahzen ve yükselen su nabzı artırır. Yüksek panikte kalp atışı, fısıltı, gölgeler ve görüş daralması oluşur. Limana, teknenin yakınına veya sakin havada güverteye dönmek paniği azaltır.

**Ekonomi:** Her tam gelgit pazar talebini değiştirir. Hurda teslimatı 1×, 1,5×, 1×, 2× döngüsünde fiyatlanır. Fiyat limanda görünür; teslim anındaki fiyat geçerlidir. Yeni eserler ayrıca kayda alınır. Kurtarılan sakinlerin dört görevi tek seferlik hurda ödülü verir; pusula görevi Fener Adası haritasını açar. Görevler teslimatta veya ilgili kişinin kurtarılışında otomatik değerlendirilir.

**Tekne:** Yük, su alma, akıntı ve motor dümen tepkisini etkiler. Sert çarpışmalar gövdeye hasar verir. Limanda tamir ücretsiz; açık denizde iki hurda gövdeyi 34 puan onarır ve suyu boşaltır.

## Kayıt

Teslim edilen eserler, kurtarılan mürettebat, projeler, donanımlar, hurda, gövde, harita keşfi, pazar döngüsü, görev ödülleri ve final tarayıcıda saklanır. Eski `gelgit.harbor.v2` kayıtları yeni alanlara güvenli varsayılanlarla yüklenir; v1 eserleri de aktarılır.

Açık seferin konumu, panik, hava ve teslim edilmemiş yük kaydedilmez. Yenileme limanda yeni sefer başlatır. Bu nedenle değerli yükü önce teslim et. Aynı seferde bölge değiştirmek açılmış kasaları veya kurtarılmış insanları çoğaltmaz. Kayıt tarayıcı depolamasına bağlıdır.

## Mimari

Dosyalar `index.html` içindeki sıralı `defer` betikleriyle yüklenir; sınıflar sorumluluklarına göre ayrıdır:

- `WeatherSystem` (`weather.js`): hava geçişleri, rüzgâr, şimşek, sis ve ömürlü tekne izleri.
- `WorldMap` (`world-map.js`): bölge bağlantıları, geçit kilitleri, sefer önbelleği, keşif ve iki harita görünümü.
- `SanitySystem`, `DivingSystem` (`sanity.js`): risk, güvenli alanlar, ses olayları, dalış ve tahliye.
- `PortLife` (`port-life.js`): sakinler, görevler, pazar, günlük metinleri, ticaret ve final.
- `Renderer` (`render.js`): önbellekli arazi, su, kıyı köpüğü, ışık, mimari ve aktör çizimi.
- `World`, `Tide` (`world.js`): arazi, çarpışma, akıntı ve rastgele gelgit.
- `Expedition`, `CrewRescue`, `HarborProgress`, `Boat`: buluntular, kurtarma, kalıcı ilerleme ve fizik.
- `Game` sistemleri koordine eder. `main.js` giriş ve arayüzü, `camera.js` takip kamerasını, `audio.js` ve `feedback.js` ses/olay geri bildirimini yönetir.

Simülasyon duraklatıldığında hava, dalış, ekonomi ve panik de durur. Çizim rastgele oyun durumunu ilerletmez. Tekne izi listesi ömürle sınırlıdır; arazi çizimleri önbelleklidir.

## Doğrulama

- `npm test`: 15 deterministik oyun testi; eski çekirdek regresyonları, geçitler, tekrar ziyaretler, dalış, panik, tek seferlik ödüller, kayıt, final ve dört bölgenin kasa erişilebilirliği.
- `npm ci` ardından `npm run test:browser`: Playwright ile masaüstü ve dokunmatik mobil testleri. Yerel Microsoft Edge kullanılır; başka kurulu kanal için `PW_CHANNEL=chrome` seçilebilir.
- Tarayıcı testleri tüm bölgeleri, hava çizimlerini, dalış ekranını, iki haritayı, günlüğü, kayıt yüklemeyi, finali ve azaltılmış hareket tercihini kontrol eder. Görseller `test-results/` altında oluşturulur; bu çıktı ve bağımlılıklar Git'e alınmaz.

Bu depo oynanabilir tarayıcı oyunudur; Steam paketleme/entegrasyonu içermez. Uzun seans dengesi ve oyuncu değerlendirmesi otomatik testlerden çıkarılamaz; bunlar oyuncu testleriyle ölçülmelidir.
