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

Çekilmeden taşkına 100 saniye var. Kasaların yeri seferden sefere değişir ve kasalar 5–12 saniyede açılır. Son 14 saniyede yükselen su yürüyüşü yavaşlatır. Taşkına yaya yakalanırsan teslim edilmemiş yükün kaybolur.

İlk rotada Boğulmuş Kaptanın Günlüğü’nü bul. İskelede indirince **Yükselt** düğmesi açılır. Liman atölyesinden feneri, demirciyi ve derin su vincini kur. Atölyedeki rota düğmesiyle açık mahalleler arasında geçiş yap.

Teslim edilen eserler ve inşa edilen yükseltmeler tarayıcıda saklanır. Açık sefer ve teslim edilmemiş yük sayfayı yenilediğinde sıfırlanır. Önceki sürümde kaydedilen koleksiyon eserleri aktarılır.

## Kod yapısı

- `world.js` harita, çarpışma ve gelgit kurallarını tutar.
- `expedition.js` mahalleleri, kasa konumlarını ve eserleri tanımlar.
- `progression.js` koleksiyonu, liman yükseltmelerini ve yerel kaydı yönetir.
- `game.js` tekne fiziğini ve oynanış etkileşimlerini yürütür.
- `camera.js` tam ekran takip kamerasını yönetir. `render.js` haritayı ve aktörleri çizer.
- `feedback.js` ortam olaylarının seslerini ve görsel efektlerini üretir.
- `main.js` klavyeyi, arayüzü ve tarayıcı döngüsünü bağlar.
