# Yurt Yoklama & Uyku Doğrulama 

 Proje, Google Apps Script ile yazılmış bir sunucu (`App.js`) ve iki HTML arayüzünden (`index.html` — öğrenci, `admin.html` — kat sorumlusu) oluşur. Veriler bir Google Sheet içinde saklanır.

**ÖN KAYIT (Uyku On-Kayıt) — Ne için ve kimler doğrulanır?**

- `Uyku On-Kayıt` butonu, erken yatmak isteyen öğrencilerin önceden kayıt vermesi içindir. Bu butonu kullanan öğrenciler "ön-kayıt" olarak işaretlenir ve kat sorumlusu tarafından özel olarak doğrulanır.
- Normal yoklama saatleri (örneğin `23:00-23:40`) arasında yoklama veren öğrencilerin ayrıca doğrulanmasına gerek yoktur; çünkü bu saatler arasında yurt kapıları kilitlenecek ve öğrencilerin çıkış yapmayacağı varsayılır. Bu ayrım sayesinde kat sorumluları yalnızca gerçekten uyurken kontrol edilmesi gereken kişileri doğrular.
- Bu uygulama mantığı, kat sorumlularının iş yükünü azaltır ve doğrulama sürecini odağa göre optimize eder.

**Dosyalar**
- `App.js` — Google Apps Script sunucu tarafı kodu. Sheets okuma/yazma, kimlik kontrolleri, zaman/konum kontrolleri ve raporlama burada.
- `index.html` — Öğrencilerin kullandığı arayüz (Uyku On-Kayıt ve Yoklama).
- `admin.html` — Kat sorumlularının bekleyen doğrulamaları yaptığı arayüz.

---

**Projenin Amacı (Kısa)**
- Öğrenciler cep telefonlarından "Uyku Ön-Kayıt" veya "Yoklama Ver" işlemi yapar.
- Bu kayıtlar Sheets'e yazılır; bazı kayıtlar kat sorumlusu onayı bekler.
- Kat sorumlusu `admin.html` ile bekleyenleri görür, oda numarası ve not girip "Dogrula" veya "Geçersiz" işaretler; Sheets güncellenir.

---

## Nasıl Çalışır — Adım Adım (Öğrenci Perspektifi)

1. Öğrenci web uygulaması URL'sine gider (Web App olarak deploy edilmelidir).
2. Site Google hesabı ile kimlik doğrulaması ister (Apps Script `Session.getActiveUser()` kullanır).
3. Arayüzde iki ana buton vardır:
   - `Uykudayim (On-Kayıt)` — konum izni alır, `kaydetUykuOnKayit` fonksiyonunu çağırır.
   - `Yoklama Ver` — konum izni alır, `kaydetYoklama` fonksiyonunu çağırır.
4. Tarayıcı, enlem/boylam (latitude/longitude), basit cihaz kimliği (hash), `userAgent`, ekran boyutları ve dokunmatik bilgileri gönderir.
5. `App.js` sunucusu:
   - Kullanıcının e-postasını alır ve `Ogrenciler` sayfasında kayıtlı mı kontrol eder.
   - Zaman pencerelerine (ön-kayıt / yoklama) göre izin verir veya reddeder.
   - Gönderilen konumun `YURT_SINIRLARI` içinde olup olmadığını kontrol eder (nokta-poligon testi).
   - Çift kayıt kontrolü yapar.
   - Uygunsa bugünün `Yoklama_dd-MM-yyyy` isimli sayfasına satır ekler; `Durum` sütununa uygun durum yazar (ör. `Yurtta_Uyku_DogrulamaBekliyor`).
6. Öğrenci ekranda başarılı/başarısız mesajı görür.

### Öğrenci Kullanım Örneği
- Adım 1: Tarayıcıda `https://<YOUR_WEB_APP_URL>` aç.
- Adım 2: "Kimlik doğrulanıyor..." mesajı görün, sonra isminiz görünsün.
-- Adım 3: "Uykudayim (On-Kayıt)" butonuna tıklayın → konum izni verin.
- Adım 4: Başarılıysa ekranda: "Uyku on-kaydi basariyla alindi! ..." mesajı görünür.

---
## Kat Sorumlusu (Admin) Akışı — Adım Adım

1. Kat sorumlusu `https://<YOUR_WEB_APP_URL>?sayfa=admin` adresine gider.
2. Sayfa `getKatSorumlusuBilgileri()` ile kimliği doğrular; `KatSorumlulari` sheet'inde kayıtlıysa yetki verilir.
3. `listeyiYenile()` bugünkü `Yoklama_dd-MM-yyyy` sayfasından `Durum === 'Yurtta_Uyku_DogrulamaBekliyor'` satırlarını çeker.
4. Her öğrenci için bir kart gösterilir; alanlar:
   - Ad-Soyad, saat, `Oda Numarası` (zorunlu), `Not` (isteğe bağlı).
   - Butonlar: `Dogrula (Yurtta)` veya `Gecersiz (Bulunamadi)`.
5. Kat sorumlusu oda numarası girip `✅` veya `❌` seçer; `kaydetDogrulama(email, karar, odaNo, not)` çağrılır.
6. Sunucu ilgili satırı bulup `Durum`, `Dogrulayan`, `DogrulamaZamani`, `OdaNo`, `Not` sütunlarını günceller; kart UI'dan kaldırılır.

### Admin Kullanım Örneği
- Adım 1: Tarayıcıda `https://<YOUR_WEB_APP_URL>?sayfa=admin` aç.
- Adım 2: Kimlik doğrulan ve kat sorumlusu olduğunu doğrula.
-- Adım 3: Bekleyen listeden bir öğrenci seç, `Oda Numarası` gir, istersen not yaz, `Dogrula` tıkla.
- Adım 4: Kart animasyonla kaybolur; Sheets'teki satır güncellenir.

---

## Google Sheet Yapısı (Detaylı)

- `Ogrenciler` sayfası:
  - Kolon A: `AdSoyad`
  - Kolon B: `Eposta`

- `KatSorumlulari` sayfası:
  - Kolon A: `AdSoyad`
  - Kolon B: `Eposta`

- Günlük yoklama sayfası: `Yoklama_dd-MM-yyyy` (başlık satırı şu kolonlar olmalı):
  1. `Tarih`
  2. `Saat`
  3. `AdSoyad`
  4. `Eposta`
  5. `Enlem`
  6. `Boylam`
  7. `CihazKimlik`
  8. `UserAgent`
  9. `EkranGenislik`
  10. `EkranYukseklik`
  11. `Dokunmatik`
  12. `Durum` (ör: `Yurtta`, `Yurtta_Uyku_Dogrulandi`, `Yurtta_Uyku_DogrulamaBekliyor`, `Gecersiz`)
  13. `Dogrulayan`
  14. `DogrulamaZamani`
  15. `OdaNo`
  16. `Not`

Örnek CSV satırı:

```
"22/11/2025","23:02:15","Ahmet Yılmaz","ahmet@example.com","38.67913","39.17372","abc123","Mozilla/5.0...","360","800","Evet","Yurtta_Uyku_DogrulamaBekliyor","","",""
```

---

## Önemli Sabitler ve Nereden Değiştirileceği
`App.js` içinde şu sabitler proje davranışını belirler:
- `SHEET_ID` — Google Sheet ID (zorunlu, projenin çalışması için doğru olmalı).
- `YURT_SINIRLARI` — Konum poligonu köşe koordinatları.
- `ONKAYIT_BASLANGIC`, `ONKAYIT_BASLANGIC_DAKIKA`, `ONKAYIT_BITIS`, `ONKAYIT_BITIS_DAKIKA` — Uyku ön-kayıt saatleri.
- `YOKLAMA_BASLANGIC`, `YOKLAMA_BITIS`, vb. — Yoklama saatleri.

Bu sabitleri değiştirmek isterseniz `App.js` dosyasını açıp uygun yerlere yeni değerleri yazın.
 
**Ek Araçlar ve Kaynaklar**
- **Konum poligonlarını görsel olarak çizmek için:** `https://www.google.com/maps/d/u/0/` (Google My Maps). Bu siteyle sınırları görsel olarak çizip köşe koordinatlarını dışa aktarabilir ve `YURT_SINIRLARI` dizisine yapıştırabilirsiniz.
- **Kişi / mail doğrulaması için (Google Cloud ayarları):** `https://console.cloud.google.com/auth/audience`. Bu ekran, OAuth2 / kimlik doğrulama yapılandırmalarında audience/client ayarları ve erişim kontrolleri için kullanışlıdır.

---

## Kurulum & Yayınlama (Adım Adım)

1. Google Drive → Yeni → `More` → `Google Apps Script` veya `script.google.com` üzerinden yeni bir proje oluşturun.
2. Proje içine üç dosyayı ekleyin (yeni dosya menüsünden):
   - `App.js` — sunucu kodunu yapıştırın.
   - `index.html` — öğrenci arayüzü kodunu yapıştırın.
   - `admin.html` — admin arayüzü kodunu yapıştırın.
3. `App.js` içindeki `SHEET_ID` sabitini kendi Sheet ID'niz ile değiştirin.
4. Gerekirse `YURT_SINIRLARI` ve saat sabitlerini düzenleyin.
5. Üst menüden `Deploy` → `New deployment` → `Web app` seçin.
   - `Execute as`: `Who access the web app`.
   - `Who has access`: Geliştirme aşamasında `Anyone with Google account` veya gereksiniminize göre seçin.
6. Deploy edip çıkan URL'yi kopyalayın; bu URL student/admin arayüzleri için kullanılacaktır:
   - Öğrenciler için: `https://<DEPLOYED_URL>`
   - Kat sorumlusu için: `https://<DEPLOYED_URL>?sayfa=admin`

### Zamanlanmış Trigger (Opsiyonel)
- Apps Script editöründen `Triggers` → `Add Trigger` ile `otomatikGecersizlestir` fonksiyonunu günlük belirli bir saatte çalışacak şekilde ayarlayın.

---

## Test Etme İpuçları
- Geliştirme sırasında saat kontrolleri yüzünden test yapamıyorsanız `App.js` içindeki zaman aralıklarını geçici olarak genişletin (ör. tüm güne açın).
- Konum kontrolü testi için `YURT_SINIRLARI` geçici olarak genişletilebilir.
- Apps Script'te `Logger.log()` kullanın; `Executions` veya `Logs` kısmından çıktıların doğruluğunu kontrol edin.
- Tarayıcıda `F12` ile konsolu açıp `index.html` / `admin.html` log ve debug alanlarını kontrol edin.

---

## Sık Karşılaşılan Hatalar ve Çözümleri
- "Kimlik doğrulanamadi": Kullanıcının oturumu yok veya `Session.getActiveUser()` e-posta döndürmüyor. Deploy ayarlarını ve erişim izinlerini kontrol edin.
- "Konum izni reddedildi": Kullanıcı tarayıcı izinlerini açmalı; HTTPS üzerinden çalıştığınızdan emin olun.
- "Yurt sinirlari disindasiniz": Gönderilen konum poligon içinde değil; test için poligonu geçici genişletin.
- Sheet bulunamıyor hatası: `SHEET_ID` yanlış veya script çalıştıran hesabın Sheet'e erişimi yok. ID'yi ve paylaşımı kontrol edin.

---
