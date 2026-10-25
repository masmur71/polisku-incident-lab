# Template Komunikasi Insiden

## 1. Pesan Awal (Saat Insiden Terdeteksi)

```
[INCIDENT] Kami mendeteksi gangguan pada layanan PolisKu.

Dampak: [deskripsi dampak ke pengguna]
Waktu terdeteksi: [timestamp]
Status: Sedang diinvestigasi

Tim sedang melakukan investigasi. Update selanjutnya dalam [X] menit.

— Tim Support PolisKu
```

## 2. Pesan Update (Selama Investigasi)

```
[UPDATE] Insiden PolisKu - [judul singkat]

Status: Masih dalam investigasi / Penyebab teridentifikasi
Temuan sementara: [ringkasan temuan]
Tindakan yang sedang dilakukan: [langkah recovery]
Estimasi pemulihan: [waktu]

— Tim Support PolisKu
```

## 3. Pesan Resolusi (Setelah Pulih)

```
[RESOLVED] Insiden PolisKu - [judul singkat]

Waktu mulai: [timestamp]
Waktu selesai: [timestamp]
Durasi dampak: [durasi]

Penyebab: [ringkasan root cause]
Tindakan yang dilakukan: [ringkasan resolusi]
Pencegahan: [tindakan pencegahan yang akan dilakukan]

Layanan telah kembali normal. Kami mohon maaf atas ketidaknyamanan ini.

— Tim Support PolisKu
```
