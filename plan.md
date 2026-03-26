# Dokumentasi Pengembangan Aplikasi Screen Share (streamzon)

Dokumentasi ini berisi panduan teknis untuk membangun aplikasi berbagi layar real-time untuk grup kecil (1-5 pengguna) dengan kontrol kualitas video yang presisi.

## 1. Tech Stack Rekomendasi
Untuk latensi terendah (ultra-low latency) dan kemudahan pengembangan skala kecil:
- **Frontend:** React.js atau Next.js (Tailwind CSS untuk UI).
- **Backend:** Node.js dengan **Socket.io** (untuk Signaling).
- **Protokol:** **WebRTC** (Peer-to-Peer). Karena hanya untuk 5 orang, koneksi P2P murni masih sangat mumpuni tanpa perlu Media Server (SFU) yang kompleks.
- **Server Tambahan:** STUN/TURN Server (Gunakan Google STUN atau Coturn) untuk menembus firewall/NAT.

## 2. Fitur Utama: Pemilihan Kualitas Video
Aplikasi akan menggunakan API `getDisplayMedia` dengan konfigurasi `constraints` yang dinamis sesuai pilihan pengguna.

### Konfigurasi Preset Kualitas
Berikut adalah pemetaan logika untuk opsi yang Anda inginkan:

| Opsi | Resolution | FPS | Ideal Bandwidth |
| :--- | :--- | :--- | :--- |
| **720p 30fps** | 1280 x 720 | 30 | 1.5 - 2 Mbps |
| **720p 60fps** | 1280 x 720 | 60 | 2.5 - 3 Mbps |
| **1080p 30fps** | 1920 x 1080 | 30 | 3.5 - 4 Mbps |
| **1080p 60fps** | 1920 x 1080 | 60 | 5 - 6 Mbps |

---

## 3. Implementasi Kode (Frontend)

### Fungsi Capture Screen dengan Opsi Dinamis
```javascript
const displayOptions = {
  '720p30': { width: 1280, height: 720, frameRate: 30 },
  '720p60': { width: 1280, height: 720, frameRate: 60 },
  '1080p30': { width: 1920, height: 1080, frameRate: 30 },
  '1080p60': { width: 1920, height: 1080, frameRate: 60 },
};

async function startCapture(presetKey) {
  const config = displayOptions[presetKey];
  
  const constraints = {
    video: {
      width: { ideal: config.width },
      height: { ideal: config.height },
      frameRate: { ideal: config.frameRate },
      displaySurface: "monitor", // atau "window" / "browser"
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    }
  };

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    return stream;
  } catch (err) {
    console.error("Gagal share screen: ", err);
  }
}
4. Alur Kerja Arsitektur
Signaling (Socket.io):

User A (Streamer) membuat "Room".

User B, C, D (Viewers) bergabung ke Room yang sama.

Server mengirimkan notifikasi ke User A bahwa ada Peer baru.

WebRTC Handshake:

User A membuat RTCPeerConnection untuk setiap Viewer.

User A mengirimkan Offer berisi deskripsi media (SDP).

Viewer mengirimkan Answer.

Keduanya bertukar ICE Candidates untuk membangun jalur data tercepat.

Optimization (Bitrate Control):

Karena Anda menginginkan 1080p 60fps, Anda perlu mengatur maxBitrate pada objek RTCRtpSender agar browser tidak menurunkan kualitas secara drastis saat terjadi fluktuasi jaringan kecil.

5. Rencana Pengembangan (Roadmap)
[ ] Sprint 1: Setup Express server dan Socket.io untuk room management.

[ ] Sprint 2: Implementasi WebRTC dasar (P2P) untuk 1-on-1.

[ ] Sprint 3: Integrasi UI pemilihan kualitas (720p/1080p) dan penanganan multi-peer (mesh network).

[ ] Sprint 4: Testing latensi dan optimasi penggunaan CPU pada 60 FPS.

6. Catatan Penting
Hardware: Streaming 1080p 60fps memerlukan daya CPU/GPU yang cukup besar pada sisi pengirim (encoding).

HTTPS: getDisplayMedia hanya bisa diakses pada domain yang menggunakan HTTPS atau localhost untuk keperluan pengembangan.