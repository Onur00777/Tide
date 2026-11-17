# TIDE

Tide (Gelgit), tam ekran kamerayla oynanan bir kıyı keşif oyunu. Sular çekilince batık mahallelerdeki kasaları aç, buluntuları koleksiyona kat ve limana yeni yapılar kur.

## Çalıştırma

Bu klasördeki `index.html` dosyasını tarayıcıda aç. Kurulum veya yerel sunucu gerekmez. Cinzel ve Inter yazı tipleri Google Fonts üzerinden yüklenir.

## Kontroller

- **WASD** veya **ok tuşları** ile tekneyi ve karakteri hareket ettir.
- **E** veya ekrandaki etkileşim düğmesiyle karaya çık, kasayı aç, tekneye bin ya da buluntuları indir.
- Kasayı açarken yerinde dur. Hareket edersen işlem kesilir.
- **Esc** ile oyunu duraklat veya sürdür.
- Üst çubuktan koleksiyonunu açabilir ve sesi kapatabilirsin. Ses ilk tıklama veya tuş basımından sonra etkinleşir.

## Sefer

Çekilme süresi her döngüde değişir. Su birikintileri köpürmeye başladığında kıyı uğultusuna ve ekranın mavi kenarlarına dikkat et. Kasalar, yosun, çamur ve erken dolan çukurlar her döngüde yer değiştirir. Kasalar 5–12 saniyede açılır.

Yosun ve çamurun etrafından dolaşabilir, su yükselince açık renkli taşlar ve çatılar üzerinden teknene dönebilirsin. Taşkın sırasında suyun içindeki yürüyüş yavaşlar. Su en yüksek seviyeye ulaştığında alçakta kalırsan akıntı bir buluntunu alabilir.

İlk rotada Boğulmuş Kaptanın Günlüğü’nü bul. İskelede indirince **Yükselt** düğmesi açılır. Liman atölyesinden feneri, demirciyi ve derin su vincini kur. Atölyedeki rota düğmesiyle açık mahalleler arasında geçiş yap.

Bazı seferlerde mahallenin içinden bir yardım ışığı gelir. Mahsur kalan kişiye yaklaş ve **E** ile sırtla. Yüksek rotadan tekneye dönüp Başlangıç Limanı'na yanaştığında kurtardığın mürettebat kalıcı olarak yerleşir.

Yerleşen her mürettebat üyesi liman atölyesinde kendi sekmesini açar. Demirci ocağı yük kapasitesini artırır. Fenercinin projesi fenerin ışığını genişletir ve kıyıya balık ağları ekler. Tersane ustası ahşap iskeleyi büyütür, vincini kurar ve tekneyi hızlandırır. Her proje limana ışıklı bir ev ekler.

Teslim edilen eserler, limana yerleşen mürettebat ve inşa edilen yükseltmeler tarayıcıda saklanır. Açık sefer ve teslim edilmemiş yük sayfayı yenilediğinde sıfırlanır. Önceki sürümde kaydedilen koleksiyon eserleri aktarılır.

## Kod yapısı

- `world.js` harita, çarpışma ve gelgit kurallarını tutar.
- `expedition.js` mahalleleri, kasa konumlarını ve eserleri tanımlar.
- `crew.js` mahsur kalan mürettebatı ve tekneye taşıma durumunu yönetir.
- `progression.js` koleksiyonu, liman yükseltmelerini ve yerel kaydı yönetir.
- `game.js` tekne fiziğini ve oynanış etkileşimlerini yürütür.
- `camera.js` tam ekran takip kamerasını yönetir. `render.js` haritayı ve aktörleri çizer.
- `feedback.js` ortam olaylarının seslerini ve görsel efektlerini üretir.
- `main.js` klavyeyi, arayüzü ve tarayıcı döngüsünü bağlar.
