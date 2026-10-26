# KiraKanban

Aynı anda birkaç yazılım projesiyle uğraşınca neyin nerede kaldığını unutuyordum. Jira'nın mantığını seviyorum ama kişisel işler için fazla ağır geliyordu. Ben de kendime hafif, krem renkli bir Kanban panosu yaptım.

Kurulum yok, hesap yok, sunucu yok. Dosyayı aç, kullanmaya başla.

## Neler yapabiliyor?

- **4 sütunlu pano:** Planlama, Başlandı, Test Aşamasında, Tamamlandı. Kartları sürükleyip bırakabilir ya da kart üzerindeki butonlarla ilerletebilirsin.
- **Çoklu proje:** Her projeye kendi rengini ver, kartlarda renkli etiket olarak görünsün. İstediğinde panoyu tek projeye göre filtrele.
- **Kartlar:** Başlık, açıklama, öncelik (düşük → kritik), iş türü (özellik, bug, iyileştirme, araştırma) ve küçük bir görsel.
- **Notlar:** Karta tıklayınca açılan pencerede tarihli notlar bırakabilirsin. Son not kartın üstünde de görünür.
- **Alt görevler:** Kart içinde checklist ve ilerleme çubuğu var.
- **Ctrl+V ile görsel:** Ekran görüntüsü alıp doğrudan yapıştırman yeterli.
- **Arşiv:** Tamamlanan işleri arşive atınca panoda yer kaplamaz. Arşiv sağdan açılan bir çekmecede durur, istersen geri yükleyebilirsin.
- **Arama ve filtre:** Başlık, kod, açıklama ve notların içinde arama yapabilir, önceliğe veya türe göre filtreleyebilirsin.
- **Yedekleme:** Tüm veriyi tek bir JSON dosyası olarak indirip geri yükleyebilirsin.

## Verilerim nerede duruyor?

Tarayıcının kendi veritabanında (IndexedDB). Hiçbir yere gönderilmez, kimse göremez. Bunun bedeli de şu: tarayıcı verisini silersen pano da gider, o yüzden ara sıra **Yedek İndir** butonunu kullanmanı öneririm.

## Çalıştırma

En basit yol: `public/index.html` dosyasını tarayıcıda aç.

Windows'ta masaüstü uygulaması gibi açmak istersen `Kira-Uygulama.vbs` dosyasına çift tıkla. Edge veya Chrome'u adres çubuğu olmadan, kendi penceresinde açar.

İstersen Node ile yerel sunucu olarak da çalıştırabilirsin. Bu modda veriler `data/db.json` dosyasına, görseller `data/uploads/` klasörüne yazılır:

```bash
node server.js
```

Sonra `http://localhost:3456` adresine git. Ek paket kurmana gerek yok.

## Yapı

```
public/
  index.html   arayüz
  style.css    krem tema
  app.js       tüm uygulama mantığı
server.js      isteğe bağlı yerel sunucu
```

Framework kullanmadım, düz HTML, CSS ve JavaScript.

## Aklımdaki eklemeler

- Koyu tema
- Bitiş tarihi ve gecikme uyarısı
- Notlarda Markdown desteği
- Telefon için daha iyi görünüm
- PWA olarak kurulabilmesi

## Lisans

İstediğin gibi kullanabilir, değiştirebilirsin.
