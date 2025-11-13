const SHEET_ID = 'SHEET ID_HERE'; // Google Sheets ID'sini buraya girin

function getYurtSinirlari() {
  const sinirlariStr = PropertiesService.getScriptProperties().getProperty('YURT_SINIRLARI');
  if (sinirlariStr) {
    try {
      return JSON.parse(sinirlariStr);
    } catch (e) {
      Logger.log('UYARI: YURT_SINIRLARI parse edilemedi. Varsayılan değer kullanılıyor.');
    }
  }
// # Yurt sınırları koordinatları (örnek)
// # Google My Maps kullanarak kendi koordinatlarınızı oluşturun: https://www.google.com/maps/d/u/0/

  return [
// # format: [enlem, boylam],
  ];
}

const YURT_SINIRLARI = getYurtSinirlari();

// Yoklama saatleri
const YOKLAMA_BASLANGIC = 23;
const YOKLAMA_BASLANGIC_DAKIKA = 0;
const YOKLAMA_BITIS = 23;
const YOKLAMA_BITIS_DAKIKA = 40;

// Uyku on-kayit saatleri
const ONKAYIT_BASLANGIC = 20;
const ONKAYIT_BASLANGIC_DAKIKA = 59;
const ONKAYIT_BITIS = 22;
const ONKAYIT_BITIS_DAKIKA = 59;

// Dogrulama son saati
const DOGRULAMA_SON_SAAT = 23;
const DOGRULAMA_SON_DAKIKA = 59;

// Web uygulamasi olarak goster
function doGet(e) {
  const sayfa = e.parameter.sayfa || 'ogrenci';
  
  if (sayfa === 'admin') {
    return HtmlService.createHtmlOutputFromFile('admin')
      .setTitle('Kat Sorumlusu - Uyku Dogrulama')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Yurt Yoklama Sistemi')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// GIRIS YAPAN KULLANICI BILGILERINI GETIRME
function getKullaniciBilgileri() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) {
      return { basari: false, mesaj: 'Kimlik dogrulanamadi. Lutfen sayfayi yenileyin veya tekrar giris yapin.' };
    }

    const ogrenci = getOgrenciByEmail(email);
    if (!ogrenci) {
      return {
        basari: false,
        mesaj: 'Erisim Reddedildi!\n\n' + email + ' e-posta adresi ogrenci listesinde kayitli degil. Lutfen yurt yonetimiyle iletisime gecin.'
      };
    }
    
    return { basari: true, adSoyad: ogrenci.adSoyad, email: ogrenci.email };

  } catch (e) {
    Logger.log('getKullaniciBilgileri Hata: ' + e.toString());
    return { basari: false, mesaj: 'Oturum bilgisi alinirken bir hata olustu: ' + e.toString() };
  }
}

// Kat sorumlusu bilgilerini getir
function getKatSorumlusuBilgileri() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) {
      return { basari: false, mesaj: 'Kimlik dogrulanamadi.' };
    }

    const katSorumlusu = getKatSorumlusuByEmail(email);
    if (!katSorumlusu) {
      return {
        basari: false,
        mesaj: 'Erisim Reddedildi! Kat sorumlusu yetkisine sahip degilsiniz.'
      };
    }
    
    return { basari: true, adSoyad: katSorumlusu.adSoyad, email: katSorumlusu.email };

  } catch (e) {
    Logger.log('getKatSorumlusuBilgileri Hata: ' + e.toString());
    return { basari: false, mesaj: 'Oturum bilgisi alinirken bir hata olustu: ' + e.toString() };
  }
}

// E-posta adresine gore ogrenci bilgilerini bulan fonksiyon
function getOgrenciByEmail(email) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ogrenciSheet = ss.getSheetByName('Ogrenciler');
  if (!ogrenciSheet) {
    Logger.log('HATA: "Ogrenciler" adinda bir sayfa bulunamadi.');
    return null;
  }

  const sonSatir = ogrenciSheet.getLastRow();
  const data = ogrenciSheet.getRange(2, 1, sonSatir - 1, 2).getValues();
  
  Logger.log('Oturum E-postasi: [' + email + '] | "Ogrenciler" sayfasinda ' + data.length + ' kayit bulundu.');

  for (let i = 0; i < data.length; i++) {
    const rowAdSoyad = data[i][0] ? data[i][0].toString().trim() : '';
    const rowEmail = data[i][1] ? data[i][1].toString().trim().toLowerCase() : '';
    
    if (rowEmail === email.toLowerCase()) {
      Logger.log('ESLESME BULUNDU: ' + rowAdSoyad);
      return { adSoyad: rowAdSoyad, email: rowEmail };
    }
  }
  
  Logger.log('UYARI: Dogu bitti ve eslesme bulunamadi.');
  return null;
}

// E-posta adresine gore kat sorumlusu bilgilerini bulan fonksiyon
function getKatSorumlusuByEmail(email) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const katSorumlusuSheet = ss.getSheetByName('KatSorumlulari');
  if (!katSorumlusuSheet) {
    Logger.log('HATA: "KatSorumlulari" adinda bir sayfa bulunamadi.');
    return null;
  }

  const sonSatir = katSorumlusuSheet.getLastRow();
  if (sonSatir < 2) {
    return null;
  }
  
  const data = katSorumlusuSheet.getRange(2, 1, sonSatir - 1, 2).getValues();

  for (let i = 0; i < data.length; i++) {
    const rowAdSoyad = data[i][0] ? data[i][0].toString().trim() : '';
    const rowEmail = data[i][1] ? data[i][1].toString().trim().toLowerCase() : '';
    
    if (rowEmail === email.toLowerCase()) {
      return { adSoyad: rowAdSoyad, email: rowEmail };
    }
  }
  
  return null;
}

// ==================== UYKU ON-KAYIT FONKSIYONU ====================
function kaydetUykuOnKayit(enlem, boylam, cihazKimlik, userAgent, ekranGenislik, ekranYukseklik, dokunmatik) {
  try {
    const kullanici = getKullaniciBilgileri();
    if (!kullanici.basari) {
      return kullanici;
    }
    
    const adSoyad = kullanici.adSoyad;
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const simdi = new Date();
    const saat = simdi.getHours();
    const dakika = simdi.getMinutes();
    
    const bugunFormatli = Utilities.formatDate(simdi, "GMT+3", "dd/MM/yyyy");
    const bugunSheet = 'Yoklama_' + Utilities.formatDate(simdi, "GMT+3", "dd-MM-yyyy");
    
    // Yoklama sayfasini kontrol et veya olustur
    let sheet = ss.getSheetByName(bugunSheet);
    if (!sheet) {
      sheet = ss.insertSheet(bugunSheet);
      sheet.appendRow([
        'Tarih', 'Saat', 'AdSoyad', 'Eposta', 'Enlem', 'Boylam', 'CihazKimlik',
        'UserAgent', 'EkranGenislik', 'EkranYukseklik', 'Dokunmatik', 'Durum',
        'Dogrulayan', 'DogrulamaZamani', 'OdaNo', 'Not'
      ]);
      sheet.getRange(1, 1, 1, 16).setFontWeight('bold').setBackground('#667eea').setFontColor('white');
    }
    
    // Mobil ve tablet kontrolleri
    if (!userAgent.toLowerCase().match(/android|iphone|ipod|blackberry|iemobile/i) || 
        userAgent.toLowerCase().match(/ipad|tablet|android(?!.*mobile)/i)) {
      return { basari: false, mesaj: 'Bu sistem sadece cep telefonlarindan kullanilabilir!' };
    }
    
    // On-kayit saat kontrolu
    const zamanUygun = onKayitSaatKontrol(saat, dakika);
    if (!zamanUygun.uygun) {
      return { basari: false, mesaj: zamanUygun.mesaj };
    }
    
    // Konum kontrolu
    if (!isInsidePolygon([parseFloat(enlem), parseFloat(boylam)], YURT_SINIRLARI)) {
      return { basari: false, mesaj: 'Yurt sinirlari disindasiniz!' };
    }
    
    // Cift kayit kontrolu
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const kayitliEmail = data[i][3] ? data[i][3].toString().trim().toLowerCase() : '';
      if (kayitliEmail === kullanici.email.trim().toLowerCase()) {
        const kayitSaati = data[i][1];
        return {
          basari: false,
          mesaj: 'Bu e-posta adresiyle bugun zaten kayit yapilmis!\n\nSaat: ' + kayitSaati + '\n\nAyni e-posta ile tekrar kayit yapilamaz!'
        };
      }
    }
    
    // Yeni on-kayit ekle
    const saatStr = Utilities.formatDate(simdi, "GMT+3", "HH:mm:ss");
    sheet.appendRow([
      bugunFormatli,
      saatStr,
      adSoyad,
      kullanici.email,
      enlem,
      boylam,
      cihazKimlik,
      userAgent,
      ekranGenislik,
      ekranYukseklik,
      dokunmatik ? 'Evet' : 'Hayir',
      'Yurtta_Uyku_DogrulamaBekliyor',
      '', '', '', ''
    ]);
    
    return {
      basari: true,
      mesaj: 'Uyku on-kaydi basariyla alindi!\n\n' + adSoyad + '\n' + bugunFormatli + ' ' + saatStr + '\n\nKat sorumlusu 23:40-00:15 arasinda dogrulama yapacaktir.'
    };
    
  } catch (error) {
    Logger.log('Uyku On-Kayit Hatasi: ' + error.toString());
    return { basari: false, mesaj: 'Sistem hatasi!\n\n' + error.toString() };
  }
}

// On-kayit saat kontrolu
function onKayitSaatKontrol(saat, dakika) {
  const toplamDakika = saat * 60 + dakika;
  const baslangic = ONKAYIT_BASLANGIC * 60 + ONKAYIT_BASLANGIC_DAKIKA;
  const bitis = ONKAYIT_BITIS * 60 + ONKAYIT_BITIS_DAKIKA;
  
  if (toplamDakika < baslangic) {
    return { 
      uygun: false, 
      mesaj: 'Henuz erken!\n\nUyku on-kaydi ' + ONKAYIT_BASLANGIC + ':' + ONKAYIT_BASLANGIC_DAKIKA.toString().padStart(2, '0') + ' - ' + ONKAYIT_BITIS + ':' + ONKAYIT_BITIS_DAKIKA.toString().padStart(2, '0') + ' arasinda yapilabilir.' 
    };
  }
  
  if (toplamDakika > bitis) {
    return { 
      uygun: false, 
      mesaj: 'Cok gec!\n\nUyku on-kaydi ' + ONKAYIT_BITIS + ':' + ONKAYIT_BITIS_DAKIKA.toString().padStart(2, '0') + ' ile bitti.\n\nArtik normal yoklama vermelisiniz (23:00-23:40).' 
    };
  }
  
  return { uygun: true };
}

// Yoklama kaydetme fonksiyonu
function kaydetYoklama(enlem, boylam, cihazKimlik, userAgent, ekranGenislik, ekranYukseklik, dokunmatik) {
  try {
    const kullanici = getKullaniciBilgileri();
    if (!kullanici.basari) {
      return kullanici;
    }
    
    const adSoyad = kullanici.adSoyad;
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const simdi = new Date();
    const saat = simdi.getHours();
    const dakika = simdi.getMinutes();
    
    const bugunFormatli = Utilities.formatDate(simdi, "GMT+3", "dd/MM/yyyy");
    const bugunSheet = 'Yoklama_' + Utilities.formatDate(simdi, "GMT+3", "dd-MM-yyyy");
    let sheet = ss.getSheetByName(bugunSheet);
    
    if (!sheet) {
      sheet = ss.insertSheet(bugunSheet);
      sheet.appendRow([
        'Tarih', 'Saat', 'AdSoyad', 'Eposta', 'Enlem', 'Boylam', 'CihazKimlik',
        'UserAgent', 'EkranGenislik', 'EkranYukseklik', 'Dokunmatik', 'Durum',
        'Dogrulayan', 'DogrulamaZamani', 'OdaNo', 'Not'
      ]);
      sheet.getRange(1, 1, 1, 16).setFontWeight('bold').setBackground('#667eea').setFontColor('white');
    }
    
    // Mobil ve tablet kontrolleri
    if (!userAgent.toLowerCase().match(/android|iphone|ipod|blackberry|iemobile/i) || 
        userAgent.toLowerCase().match(/ipad|tablet|android(?!.*mobile)/i)) {
      return { basari: false, mesaj: 'Bu sistem sadece cep telefonlarindan kullanilabilir!' };
    }
    
    // Saat kontrolu
    const zamanUygun = saatKontrol(saat, dakika);
    if (!zamanUygun.uygun) {
      return { basari: false, mesaj: zamanUygun.mesaj };
    }
    
    // Konum kontrolu
    if (!isInsidePolygon([parseFloat(enlem), parseFloat(boylam)], YURT_SINIRLARI)) {
      return { basari: false, mesaj: 'Yurt sinirlari disindasiniz!' };
    }
    
    // Cift kayit kontrolu
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const kayitliEmail = data[i][3] ? data[i][3].toString().trim().toLowerCase() : '';
      if (kayitliEmail === kullanici.email.trim().toLowerCase()) {
        const kayitTarihi = Utilities.formatDate(new Date(data[i][0]), "GMT+3", "dd.MM.yyyy");
        const kayitSaati = data[i][1];
        return {
          basari: false,
          mesaj: 'Bu e-posta adresiyle bugun zaten yoklama verilmis!\n\nTarih: ' + kayitTarihi + '\nSaat: ' + kayitSaati + '\n\nAyni e-posta ile tekrar yoklama verilemez!'
        };
      }
    }
    
    // Yeni yoklama ekle
    const saatStr = Utilities.formatDate(simdi, "GMT+3", "HH:mm:ss");
    sheet.appendRow([
      bugunFormatli,
      saatStr,
      adSoyad,
      kullanici.email,
      enlem,
      boylam,
      cihazKimlik,
      userAgent,
      ekranGenislik,
      ekranYukseklik,
      dokunmatik ? 'Evet' : 'Hayir',
      'Yurtta',
      '', '', '', ''
    ]);
    
    return {
      basari: true,
      mesaj: 'Yoklama basariyla kaydedildi!\n\n' + adSoyad + '\n' + bugunFormatli + ' ' + saatStr + '\nKonum: Yurt ici'
    };
    
  } catch (error) {
    Logger.log('Hata: ' + error.toString());
    return { basari: false, mesaj: 'Sistem hatasi!\n\n' + error.toString() };
  }
}

// Saat kontrolu
function saatKontrol(saat, dakika) {
  const toplamDakika = saat * 60 + dakika;
  const baslangic = YOKLAMA_BASLANGIC * 60 + YOKLAMA_BASLANGIC_DAKIKA;
  const bitis = YOKLAMA_BITIS * 60 + YOKLAMA_BITIS_DAKIKA;
  
  if (toplamDakika < baslangic) {
    return { uygun: false, mesaj: 'Henuz erken!\n\nYoklama ' + YOKLAMA_BASLANGIC + ':' + YOKLAMA_BASLANGIC_DAKIKA.toString().padStart(2, '0') + ' da baslayacak.' };
  }
  
  if (toplamDakika > bitis) {
    return { uygun: false, mesaj: 'Cok gec!\n\nYoklama ' + YOKLAMA_BITIS + ':' + YOKLAMA_BITIS_DAKIKA.toString().padStart(2, '0') + ' te bitti.' };
  }
  
  return { uygun: true };
}

// Poligon kontrolu
function isInsidePolygon(point, vs) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ==================== KAT SORUMLUSU FONKSIYONLARI ====================

// Dogrulama bekleyen ogrencileri getir
function getDogrulamaBekleyenler() {
  Logger.log('=== getDogrulamaBekleyenler BASLIYOR ===');
  
  try {
    Logger.log('1. Kat sorumlusu yetkisi kontrol ediliyor...');
    
    // Kat sorumlusu yetkisi kontrolu
    const katSorumlusu = getKatSorumlusuBilgileri();
    Logger.log('2. Kat sorumlusu bilgisi alindi: ' + JSON.stringify(katSorumlusu));
    
    if (!katSorumlusu) {
      Logger.log('HATA: katSorumlusu null');
      return { basari: false, mesaj: 'Kat sorumlusu bilgisi alinamadi (null)' };
    }
    
    if (!katSorumlusu.basari) {
      Logger.log('HATA: katSorumlusu.basari = false');
      return { basari: false, mesaj: katSorumlusu.mesaj || 'Yetki hatasi' };
    }
    
    Logger.log('3. Yetki kontrolu BASARILI. Sheets aciliyor...');
    
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const simdi = new Date();
    const bugunFormatli = Utilities.formatDate(simdi, "GMT+3", "dd-MM-yyyy");
    const yoklamaSheetAdi = 'Yoklama_' + bugunFormatli;
    
    Logger.log('4. Aranan sayfa: ' + yoklamaSheetAdi);
    
    const yoklamaSheet = ss.getSheetByName(yoklamaSheetAdi);
    
    if (!yoklamaSheet) {
      Logger.log('HATA: Yoklama sayfasi bulunamadi: ' + yoklamaSheetAdi);
      return { basari: false, mesaj: 'Bugunun yoklama sayfasi bulunamadi: ' + yoklamaSheetAdi };
    }
    
    Logger.log('5. Yoklama sayfasi bulundu. Veriler okunuyor...');
    
    const data = yoklamaSheet.getDataRange().getValues();
    Logger.log('6. Toplam satir sayisi: ' + data.length);
    
    const bekleyenler = [];
    
    for (let i = 1; i < data.length; i++) {
      const durum = data[i][11] ? data[i][11].toString().trim() : '';
      
      if (i <= 3) {
        Logger.log('Satir ' + (i+1) + ' - Durum: [' + durum + ']');
      }
      
      if (durum === 'Yurtta_Uyku_DogrulamaBekliyor') {
        const ogrenci = {
          satir: i + 1,
          adSoyad: data[i][2] || 'Bilinmeyen',
          email: data[i][3] || '',
          saat: data[i][1] ? data[i][1].toString() : '',
          odaNo: data[i][14] || '',
          not: data[i][15] || ''
        };
        Logger.log('BEKLEYEN BULUNDU: ' + JSON.stringify(ogrenci));
        bekleyenler.push(ogrenci);
      }
    }
    
    Logger.log('7. Toplam bekleyen sayisi: ' + bekleyenler.length);
    
    const sonuc = { 
      basari: true, 
      liste: bekleyenler, 
      katSorumlusuAdi: katSorumlusu.adSoyad 
    };
    
    Logger.log('8. Return edilecek sonuc: ' + JSON.stringify(sonuc));
    Logger.log('=== getDogrulamaBekleyenler TAMAMLANDI ===');
    
    return sonuc;
    
  } catch (error) {
    Logger.log('!!! KRITIK HATA !!!');
    Logger.log('Hata mesaji: ' + error.toString());
    Logger.log('Hata stack: ' + error.stack);
    
    const hataSONUC = { basari: false, mesaj: 'Sistem hatasi: ' + error.toString() };
    Logger.log('Hata sonucu return ediliyor: ' + JSON.stringify(hataSONUC));
    
    return hataSONUC;
  }
}

// Kat sorumlusu dogrulama kaydet
function kaydetDogrulama(email, karar, odaNo, not) {
  try {
    // Kat sorumlusu yetkisi kontrolu
    const katSorumlusu = getKatSorumlusuBilgileri();
    if (!katSorumlusu.basari) {
      return katSorumlusu;
    }
    
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const simdi = new Date();
    const bugunFormatli = Utilities.formatDate(simdi, "GMT+3", "dd-MM-yyyy");
    const yoklamaSheetAdi = 'Yoklama_' + bugunFormatli;
    const yoklamaSheet = ss.getSheetByName(yoklamaSheetAdi);
    
    if (!yoklamaSheet) {
      return { basari: false, mesaj: 'Bugunun yoklama sayfasi bulunamadi.' };
    }
    
    const data = yoklamaSheet.getDataRange().getValues();
    let bulundu = false;
    
    for (let i = 1; i < data.length; i++) {
      const kayitliEmail = data[i][3] ? data[i][3].toString().trim().toLowerCase() : '';
      
      if (kayitliEmail === email.toLowerCase()) {
        const satirNo = i + 1;
        const dogrulamaZamani = Utilities.formatDate(simdi, "GMT+3", "dd/MM/yyyy HH:mm:ss");
        
        let yeniDurum = '';
        if (karar === 'dogrulandi') {
          yeniDurum = 'Yurtta_Uyku_Dogrulandi';
        } else if (karar === 'gecersiz') {
          yeniDurum = 'Uyku_Gecersiz';
        }
        
        yoklamaSheet.getRange(satirNo, 12).setValue(yeniDurum);
        yoklamaSheet.getRange(satirNo, 13).setValue(katSorumlusu.adSoyad);
        yoklamaSheet.getRange(satirNo, 14).setValue(dogrulamaZamani);
        yoklamaSheet.getRange(satirNo, 15).setValue(odaNo);
        yoklamaSheet.getRange(satirNo, 16).setValue(not);
        
        bulundu = true;
        break;
      }
    }
    
    if (bulundu) {
      return { basari: true, mesaj: 'Dogrulama basariyla kaydedildi.' };
    } else {
      return { basari: false, mesaj: 'Kayit bulunamadi.' };
    }
    
  } catch (error) {
    Logger.log('kaydetDogrulama Hatasi: ' + error.toString());
    return { basari: false, mesaj: 'Sistem hatasi: ' + error.toString() };
  }
}

// ==================== OTOMATIK GECERSIZLESTIRME (00:30'da calisacak) ====================
function otomatikGecersizlestir() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const simdi = new Date();
    const bugunFormatli = Utilities.formatDate(simdi, "GMT+3", "dd-MM-yyyy");
    const yoklamaSheetAdi = 'Yoklama_' + bugunFormatli;
    const yoklamaSheet = ss.getSheetByName(yoklamaSheetAdi);
    
    if (!yoklamaSheet) {
      Logger.log('Yoklama sayfasi bulunamadi.');
      return;
    }
    
    const data = yoklamaSheet.getDataRange().getValues();
    let gecersizSayisi = 0;
    
    for (let i = 1; i < data.length; i++) {
      const durum = data[i][11] ? data[i][11].toString().trim() : '';
      
      if (durum === 'Yurtta_Uyku_DogrulamaBekliyor') {
        const satirNo = i + 1;
        yoklamaSheet.getRange(satirNo, 12).setValue('Uyku_Gecersiz_ZamanAsimi');
        yoklamaSheet.getRange(satirNo, 14).setValue(Utilities.formatDate(simdi, "GMT+3", "dd/MM/yyyy HH:mm:ss"));
        yoklamaSheet.getRange(satirNo, 16).setValue('Otomatik gecersizlestirildi - dogrulama suresi asimi');
        gecersizSayisi++;
      }
    }
    
    Logger.log('Otomatik gecersizlestirme tamamlandi. ' + gecersizSayisi + ' kayit gecersiz yapildi.');
    
  } catch (error) {
    Logger.log('otomatikGecersizlestir Hatasi: ' + error.toString());
  }
}

// ==================== RAPOR FONKSIYONLARI ====================

function getKayitliOgrenciler() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ogrenciSheet = ss.getSheetByName('Ogrenciler');
  if (!ogrenciSheet) throw new Error('Ogrenciler sheet\'i bulunamadi!');
  const data = ogrenciSheet.getDataRange().getValues();
  const ogrenciler = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) ogrenciler.push(data[i][0].toString().trim());
  }
  return ogrenciler;
}

function getYoklamaVerenler(tarih) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const bugunSheet = 'Yoklama_' + Utilities.formatDate(tarih, "GMT+3", "dd-MM-yyyy");
  const yoklamaSheet = ss.getSheetByName(bugunSheet);
  if (!yoklamaSheet) return [];
  const data = yoklamaSheet.getDataRange().getValues();
  const yoklamaVerenler = [];
  for (let i = 1; i < data.length; i++) {
    const durum = data[i][11] ? data[i][11].toString().trim() : '';
    if (data[i][2] && (durum === 'Yurtta' || durum === 'Yurtta_Uyku_Dogrulandi')) {
      yoklamaVerenler.push(data[i][2].toString().trim());
    }
  }
  return yoklamaVerenler;
}

function getBugunYoklamaVerenler() {
  return getYoklamaVerenler(new Date());
}

function yoklamaKontrolEt() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let raporSheet = ss.getSheetByName('Yoklama_Rapor');
    if (!raporSheet) {
      raporSheet = ss.insertSheet('Yoklama_Rapor');
      raporSheet.appendRow(['Tarih', 'Yoklama Vermeyenler', 'Toplam Eksik', 'Yoklama Veren', 'Toplam Ogrenci']);
      raporSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    }
    const tumOgrenciler = getKayitliOgrenciler();
    const yoklamaVerenler = getBugunYoklamaVerenler();
    const yoklamaVermeyenler = tumOgrenciler.filter(ogrenci => !yoklamaVerenler.includes(ogrenci));
    const bugun = Utilities.formatDate(new Date(), "GMT+3", "dd/MM/yyyy HH:mm");
    
    if (yoklamaVermeyenler.length > 0) {
      raporSheet.appendRow([bugun, yoklamaVermeyenler.join(', '), yoklamaVermeyenler.length, yoklamaVerenler.length, tumOgrenciler.length]);
    } else {
      raporSheet.appendRow([bugun, 'Tum ogrenciler yoklama verdi', 0, yoklamaVerenler.length, tumOgrenciler.length]);
    }
    raporSheet.autoResizeColumns(1, 5);
    return { basari: true, toplamOgrenci: tumOgrenciler.length, yoklamaVeren: yoklamaVerenler.length, yoklamaVermeyen: yoklamaVermeyenler.length, liste: yoklamaVermeyenler };
  } catch (error) {
    Logger.log('Hata: ' + error.toString());
    return { basari: false, hata: error.toString() };
  }
}

function gunlukRaporOlustur() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const raporSheetAdi = 'Gunluk_Rapor';
    let raporSheet = ss.getSheetByName(raporSheetAdi);

    if (!raporSheet) {
      raporSheet = ss.insertSheet(raporSheetAdi);
      raporSheet.appendRow([
        'Tarih',
        'Yoklama Vermeyenler',
        'Toplam Eksik Sayisi',
        'Normal Yoklama',
        'Uyku Dogrulandi',
        'Uyku Gecersiz',
        'Toplam Ogrenci'
      ]);
      raporSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#ff9800').setFontColor('#ffffff');
    }

    const bugun = new Date();
    const oncekiGun = new Date(bugun.getTime() - (24 * 60 * 60 * 1000));
    const oncekiGunFormatli = Utilities.formatDate(oncekiGun, "GMT+3", "dd-MM-yyyy");
    const yoklamaSheetAdi = 'Yoklama_' + oncekiGunFormatli;
    const yoklamaSheet = ss.getSheetByName(yoklamaSheetAdi);
    
    const tumOgrenciler = getKayitliOgrenciler();
    
    if (!yoklamaSheet) {
      raporSheet.appendRow([
        Utilities.formatDate(oncekiGun, "GMT+3", "dd/MM/yyyy"),
        'Yoklama sayfasi bulunamadi',
        tumOgrenciler.length,
        0, 0, 0,
        tumOgrenciler.length
      ]);
      Logger.log('Yoklama sayfasi bulunamadi: ' + yoklamaSheetAdi);
      return;
    }
    
    const data = yoklamaSheet.getDataRange().getValues();
    const yoklamaVerenler = [];
    let normalYoklama = 0;
    let uykuDogrulandi = 0;
    let uykuGecersiz = 0;
    
    for (let i = 1; i < data.length; i++) {
      const adSoyad = data[i][2] ? data[i][2].toString().trim() : '';
      const durum = data[i][11] ? data[i][11].toString().trim() : '';
      
      if (adSoyad) {
        if (durum === 'Yurtta') {
          normalYoklama++;
          yoklamaVerenler.push(adSoyad);
        } else if (durum === 'Yurtta_Uyku_Dogrulandi') {
          uykuDogrulandi++;
          yoklamaVerenler.push(adSoyad);
        } else if (durum === 'Uyku_Gecersiz' || durum === 'Uyku_Gecersiz_ZamanAsimi') {
          uykuGecersiz++;
        }
      }
    }
    
    const yoklamaVermeyenler = tumOgrenciler.filter(ogrenci => !yoklamaVerenler.includes(ogrenci));
    const raporTarihi = Utilities.formatDate(oncekiGun, "GMT+3", "dd/MM/yyyy");
    
    raporSheet.appendRow([
      raporTarihi,
      yoklamaVermeyenler.length > 0 ? yoklamaVermeyenler.join(', ') : 'TUM OGRENCILER YOKLAMA VERDI',
      yoklamaVermeyenler.length,
      normalYoklama,
      uykuDogrulandi,
      uykuGecersiz,
      tumOgrenciler.length
    ]);
    
    raporSheet.autoResizeColumns(1, 7);
    
    Logger.log(raporTarihi + ' tarihli rapor basariyla olusturuldu.');

  } catch (error) {
    Logger.log('Gunluk rapor olusturulurken HATA: ' + error.toString());
  }
}