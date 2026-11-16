# TIDE

Tide (Gelgit), tarayıcıda çalışan yukarıdan görünümlü bir 2B keşif ve liman kurma RPG prototipi. Düşük suda açılan üç mahalleye sefer yap. Nadir buluntuları iskeleye getirdikçe limanı geliştir, yeni rotalar aç ve kıyının hikâyesini günlüğe işle.

## Çalıştırma

Bu klasördeki `index.html` dosyasını tarayıcıda aç. Kurulum veya yerel sunucu gerekmez.

## Kontroller

- **WASD** veya **ok tuşları** ile tekneyi ve karakteri hareket ettir.
- Tekne kademeli hızlanır. Yön tuşunu bıraktığında yavaşlayarak durur. Kıyıya yaklaşırken süzülme payı bırakabilirsin.
- **E** ile karaya çık, kilitli bir evi aç, tekneye geri bin veya iskelede yükünü teslim et.
- Hurdaları ve mavi anahtarı üzerinden yürüyerek al. Anahtarı bulduktan sonra evin kilidini açmak için kısa süre yerinde dur.
- **Esc** ile oyunu duraklat veya sürdür.
- Üst çubuktan günlüğü açabilir ve sesi kapatabilirsin. Ses, ilk tıklama veya tuş basımından sonra etkinleşir.

## Sefer

Yayadayken sayaç taşkına kalan süreyi, alt bant ise tekneye tahmini dönüş süresini gösterir. Yükselme evresi 8 saniye sürer ve su yürüyüşü yavaşlatır. Taşkına yaya yakalanırsan teslim edilmemiş yükün kaybolur.

İlk hedef için Kayıp Kaptan’ın Günlüğü ve 3 hurda teslim et. Liman hedefleri sıradaki rotayı ve ödülü gösterir. Daha önce nadir buluntu çıkardığın bir evi yeniden açtığında, bir yük yuvası kaplayan ve 4 hurda değerinde olan bir derin sandık bulursun.

İskelede teslim edilen hurda, buluntular ve sefer rekoru tarayıcı depolamasında saklanır. Açık sefer ve teslim edilmemiş yük sayfayı yenilediğinde sıfırlanır.

## Kod yapısı

- `world.js` harita, çarpışma ve gelgit kurallarını tutar.
- `expedition.js` mahalleleri, anahtar konumlarını ve sefer ganimetlerini tanımlar.
- `progression.js` liman hedeflerini, kıyı günlüğünü ve yerel kaydı yönetir.
- `game.js` tekne fiziğini ve oynanış etkileşimlerini yürütür.
- `render.js` haritayı ve aktörleri çizer. `feedback.js` sesleri ve toplama efektlerini üretir.
- `main.js` klavyeyi, arayüzü ve tarayıcı döngüsünü bağlar.
